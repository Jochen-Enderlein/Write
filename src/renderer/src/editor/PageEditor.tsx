import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { filterSuggestionItems } from '@blocknote/core/extensions'
import { de, en } from '@blocknote/core/locales'
import { syntaxHighlighter } from '@blocknote/code-block'
import {
  BasicTextStyleButton,
  DragHandleMenu,
  FormattingToolbar,
  FormattingToolbarController,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
  TableColumnHeaderItem,
  TableRowHeaderItem,
  type DefaultReactSuggestionItem,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  useBlockNoteEditor,
  useComponentsContext,
  useCreateBlockNote,
  useEditorState
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import type { PageFile, WriteResult } from '@shared/types'
import {
  type Block,
  createBaseline,
  markdownToBlocks,
  parseMarkdownBody,
  plainText,
  serializeBody
} from '@shared/markdown'
import { buildFrontmatter, splitFrontmatter, updateFrontmatter } from '@shared/frontmatter'
import { composePage, readHeader } from '@shared/page'
import { resolveRelative } from '@shared/paths'
import { normalizeTitle } from '@shared/wikilinks'
import type { EditorView } from 'prosemirror-view'
import { invoke } from '../api'
import i18next, { t } from '../i18n'
import { useStore, type HeadingInfo } from '../store'
import { useColorScheme, useIpcEvent } from '../lib/hooks'
import { scrollBehavior } from '../lib/motion'
import { CalloutIcon, DiagramIcon, DocIcon, HighlighterIcon, PlusIcon } from '../components/Icons'
import { buildExportHtml } from './exportHtml'
import { prepareBlocks, schema, type WriteEditor } from './schema'

export interface PageEditorHandle {
  flush(): Promise<void>
  /** Saves even if the file changed on disk (user chose "keep mine"). */
  forceSave(): Promise<void>
  currentText(): string
  insertMarkdown(md: string): void
  focusStart(): void
  stats(): { words: number }
  headings(): HeadingInfo[]
  scrollToBlock(id: string): void
  scrollToHeading(text: string): boolean
  updateFrontmatter(changes: Record<string, unknown>): void
  exportHtml(): string
  view(): EditorView | null
}

interface Props {
  file: PageFile
  onStatus(s: 'idle' | 'dirty' | 'saving' | 'saved'): void
  onConflict(r: Extract<WriteResult, { ok: false }>): void
}

const SAVE_DELAY = 500
const COUNT_DELAY = 300

function countWords(blocks: Block[]): number {
  return (collectText(blocks).match(/[\p{L}\p{N}]+/gu) ?? []).length
}
const HIDDEN_SLASH_ITEMS = new Set([
  'toggle_list',
  'toggle_heading',
  'toggle_heading_2',
  'toggle_heading_3',
  'page_break',
  'emoji'
])
const HIDDEN_TOOLBAR = new Set([
  'underlineStyleButton',
  'textAlignLeftButton',
  'textAlignCenterButton',
  'textAlignRightButton',
  'colorStyleButton',
  'addCommentButton',
  'addTiptapCommentButton',
  'fileRenameButton',
  'fileDownloadButton'
])

let idCounter = 0
const makeId = (): string => `blk-${Date.now().toString(36)}-${(++idCounter).toString(36)}`

/** Turns a vault-relative path into a URL the custom protocol serves. */
function assetUrl(rel: string): string {
  return 'vault-asset://vault/' + rel.split('/').map(encodeURIComponent).join('/')
}

export const PageEditor = forwardRef<PageEditorHandle, Props>(function PageEditor(
  { file, onStatus, onConflict },
  ref
) {
  const scheme = useColorScheme()
  const path = file.path

  // Parse once per loaded file; the editor is recreated by the parent when the file reloads.
  const loaded = useMemo(() => {
    const header = readHeader(path, file.text)
    const raw = parseMarkdownBody(header.body, makeId)
    const parsed = { ...raw, blocks: prepareBlocks(raw.blocks) }
    return { header, parsed }
  }, [path, file.text])

  const dict = i18next.language === 'en' ? en : de
  const editor = useCreateBlockNote(
    {
      schema,
      dictionary: {
        ...dict,
        placeholders: {
          ...dict.placeholders,
          default: t('page.editorPlaceholder'),
          emptyDocument: t('page.editorPlaceholder')
        }
      },
      initialContent: loaded.parsed.blocks.length ? (loaded.parsed.blocks as never) : undefined,
      extensions: [syntaxHighlighter],
      tables: {
        headers: true,
        splitCells: false,
        cellBackgroundColor: false,
        cellTextColor: false
      },
      resolveFileUrl: async (url: string) => {
        const rel = resolveRelative(path, url)
        return rel === null ? url : assetUrl(rel)
      },
      uploadFile: async (f: File) =>
        invoke('asset:save', path, f.name, new Uint8Array(await f.arrayBuffer())),
      pasteHandler: ({ event, editor: ed, defaultPasteHandler }) => {
        const data = event.clipboardData
        const inCode = ed.getTextCursorPosition().block.type === 'codeBlock'
        if (
          !data ||
          inCode ||
          data.files.length ||
          data.types.includes('blocknote/html') ||
          data.types.includes('vscode-editor-data')
        )
          return defaultPasteHandler()
        // Everything else goes through our own parsers and prepareBlocks(), like a loaded file.
        // BlockNote's default would pick its own markdown parser whenever the text looks like
        // markdown, even next to HTML, and e.g. a ```ts fence then breaks the whole paste.
        const html = data.getData('text/html')
        const text = data.getData('text/markdown') || data.getData('text/plain')
        let blocks: Block[]
        if (text && (data.types.includes('text/markdown') || looksLikeMarkdown(text, !html)))
          blocks = markdownToBlocks(text, makeId)
        else if (html) blocks = ed.tryParseHTMLToBlocks(html) as unknown as Block[]
        else return defaultPasteHandler()
        blocks = prepareBlocks(blocks)
        if (blocks.length <= 1 && blocks[0]?.type === 'paragraph') {
          ed.insertInlineContent((blocks[0].content ?? []) as never)
          return true
        }
        insertBlocksAtCursor(ed as WriteEditor, blocks)
        return true
      }
    },
    []
  )

  const state = useRef({
    header: loaded.header,
    baseline: createBaseline(loaded.parsed, editor.document as unknown as Block[]),
    hash: file.hash,
    lastBody: '',
    timer: 0 as unknown as ReturnType<typeof setTimeout>,
    saving: Promise.resolve() as Promise<void>,
    dirty: false,
    /** Frontmatter changed (icon, tags) while the body may be unchanged. */
    headerDirty: false,
    conflict: false,
    countTimer: 0 as unknown as ReturnType<typeof setTimeout>
  })

  useEffect(() => {
    if (!useStore.getState().pendingEditorFocus) return
    useStore.setState({ pendingEditorFocus: false })
    const first = editor.document[0]
    if (first) editor.setTextCursorPosition(first, 'start')
    editor.focus()
  }, [editor])

  const scrollToBlock = useCallback(
    (id: string) => {
      const block = editor.getBlock(id)
      if (!block) return
      editor.setTextCursorPosition(block, 'start')
      editor.focus()
      editor.domElement
        ?.querySelector(`[data-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: 'start', behavior: scrollBehavior() })
    },
    [editor]
  )

  const headings = useCallback((): HeadingInfo[] => {
    const out: HeadingInfo[] = []
    const walk = (blocks: Block[]): void => {
      for (const b of blocks) {
        if (b.type === 'heading' && b.id)
          out.push({ id: b.id, level: Number(b.props.level ?? 1), text: plainText(b.content) })
        walk(b.children)
      }
    }
    walk(editor.document as unknown as Block[])
    return out
  }, [editor])

  const scrollToHeading = useCallback(
    (text: string): boolean => {
      const want = normalizeTitle(text)
      const h = headings().find((x) => normalizeTitle(x.text) === want)
      if (h) scrollToBlock(h.id)
      return Boolean(h)
    },
    [headings, scrollToBlock]
  )

  // `[[Seite#Abschnitt]]`: jump to the heading once the page is open
  useEffect(() => {
    const anchor = useStore.getState().pendingAnchor
    if (!anchor) return
    useStore.setState({ pendingAnchor: null })
    requestAnimationFrame(() => scrollToHeading(anchor))
  }, [scrollToHeading])

  // Word count for the toolbar, and the current block for focus mode
  useEffect(() => {
    useStore.setState({ wordCount: countWords(editor.document as unknown as Block[]) })
    const style = document.createElement('style')
    document.head.appendChild(style)
    const off = editor.onSelectionChange(() => {
      let id = ''
      try {
        id = editor.getTextCursorPosition().block.id
      } catch {
        // no selection
      }
      style.textContent = id
        ? `.focus-mode .write-editor [data-id="${CSS.escape(id)}"] { --focus-dim: 1; }`
        : ''
    })
    return () => {
      off()
      style.remove()
    }
  }, [editor])

  useEffect(() => {
    // What "unchanged" serialises to – the file body itself, byte for byte
    state.current.lastBody = serializeBody(
      editor.document as unknown as Block[],
      state.current.baseline
    )
  }, [editor])

  const save = useCallback(
    (force = false): Promise<void> => {
      const s = state.current
      const run = async (): Promise<void> => {
        if (s.conflict && !force) return
        const body = serializeBody(editor.document as unknown as Block[], s.baseline)
        if (body === s.lastBody && !force && !s.headerDirty) {
          s.dirty = false
          onStatus('idle')
          return
        }
        const text = composePage(s.header, path, body)
        onStatus('saving')
        const res = await invoke('page:write', path, text, force ? null : s.hash)
        if (res.ok) {
          s.hash = res.hash
          s.lastBody = body
          s.header = readHeader(path, text)
          s.dirty = false
          s.headerDirty = false
          s.conflict = false
          onStatus('saved')
        } else {
          s.conflict = true
          onConflict(res)
        }
      }
      s.saving = s.saving.then(run, run)
      return s.saving
    },
    [editor, path, onStatus, onConflict]
  )

  const flush = useCallback(async () => {
    clearTimeout(state.current.timer)
    if (state.current.dirty) await save()
    else await state.current.saving
  }, [save])

  useEffect(() => {
    const onBeforeUnload = (): void => void flush()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      void flush()
    }
  }, [flush])

  useImperativeHandle(
    ref,
    () => ({
      flush,
      forceSave: () => save(true),
      currentText: () =>
        composePage(
          state.current.header,
          path,
          serializeBody(editor.document as unknown as Block[], state.current.baseline)
        ),
      insertMarkdown: (md) =>
        insertBlocksAtCursor(editor, prepareBlocks(markdownToBlocks(md, makeId))),
      focusStart: () => {
        const first = editor.document[0]
        if (first) editor.setTextCursorPosition(first, 'start')
        editor.focus()
      },
      stats: () => ({ words: countWords(editor.document as unknown as Block[]) }),
      headings,
      scrollToBlock,
      scrollToHeading,
      updateFrontmatter: (changes) => {
        const s = state.current
        const raw = s.header.raw || buildFrontmatter({})
        const nextRaw = updateFrontmatter(raw, changes)
        const { data } = splitFrontmatter(nextRaw)
        s.header = { ...readHeader(path, nextRaw), raw: nextRaw, data }
        s.headerDirty = true
        s.dirty = true
        clearTimeout(s.timer)
        void save()
      },
      exportHtml: () =>
        buildExportHtml(
          editor.domElement,
          state.current.header.title,
          state.current.header.icon,
          i18next.language
        ),
      view: () => {
        try {
          return editor.prosemirrorView ?? null
        } catch {
          return null
        }
      }
    }),
    [editor, flush, save, path, headings, scrollToBlock, scrollToHeading]
  )

  const onChange = useCallback(() => {
    const s = state.current
    s.dirty = true
    onStatus('dirty')
    clearTimeout(s.timer)
    s.timer = setTimeout(() => void save(), SAVE_DELAY)
    useStore.setState((st) => ({ docVersion: st.docVersion + 1 }))
    clearTimeout(s.countTimer)
    s.countTimer = setTimeout(
      () => useStore.setState({ wordCount: countWords(editor.document as unknown as Block[]) }),
      COUNT_DELAY
    )
  }, [save, onStatus, editor])

  const templates = useTemplates()
  const titles = useStore((st) => st.titles)

  const slashItems = useCallback(
    async (query: string): Promise<DefaultReactSuggestionItem[]> => {
      const defaults = getDefaultReactSlashMenuItems(editor).filter(
        (i) => !HIDDEN_SLASH_ITEMS.has((i as { key?: string }).key ?? '')
      )
      const extra: DefaultReactSuggestionItem[] = [
        {
          title: t('editor.callout'),
          subtext: t('editor.calloutHint'),
          aliases: ['callout', 'hinweis', 'note', 'notiz', 'warnung', 'tipp'],
          group: t('editor.groupMarkdown'),
          icon: <CalloutIcon size={18} />,
          onItemClick: () => replaceOrInsert(editor, { type: 'callout', props: { kind: 'note' } })
        },
        {
          title: t('editor.mermaid'),
          subtext: t('editor.mermaidHint'),
          aliases: ['mermaid', 'diagramm', 'diagram', 'flowchart'],
          group: t('editor.groupMarkdown'),
          icon: <DiagramIcon size={18} />,
          onItemClick: () =>
            replaceOrInsert(editor, {
              type: 'mermaid',
              content: 'graph TD\n  A[Start] --> B[Ziel]'
            })
        },
        ...templates.map((tpl) => ({
          title: t('editor.template', { name: tpl.name }),
          aliases: ['vorlage', 'template', tpl.name.toLowerCase()],
          group: t('editor.templates'),
          icon: <DocIcon size={18} />,
          onItemClick: () => {
            void invoke('templates:render', tpl.path, state.current.header.title).then((md) =>
              insertBlocksAtCursor(editor, prepareBlocks(markdownToBlocks(md, makeId)))
            )
          }
        }))
      ]
      return filterSuggestionItems([...defaults, ...extra], query)
    },
    [editor, templates]
  )

  const linkItems = useCallback(
    async (query: string): Promise<DefaultReactSuggestionItem[]> => {
      const q = normalizeTitle(query)
      const matches = titles
        .filter((m) => m.path !== path && (!q || normalizeTitle(m.title).includes(q)))
        .sort(
          (a, b) =>
            Number(!normalizeTitle(a.title).startsWith(q)) -
            Number(!normalizeTitle(b.title).startsWith(q))
        )
        .slice(0, 12)
      const insert = (target: string) => () =>
        editor.insertInlineContent([
          { type: 'wikilink', props: { target, alias: '' } },
          ' '
        ] as never)
      const items: DefaultReactSuggestionItem[] = matches.map((m) => ({
        title: m.title,
        subtext: m.path.includes('/') ? m.path.replace(/\/[^/]+$/, '') : undefined,
        icon: m.icon ? <span className="slash-glyph">{m.icon}</span> : <DocIcon size={18} />,
        onItemClick: insert(m.title)
      }))
      if (query.trim() && !matches.some((m) => normalizeTitle(m.title) === q)) {
        items.push({
          title: t('editor.linkCreate', { title: query.trim() }),
          icon: <PlusIcon size={18} />,
          onItemClick: insert(query.trim())
        })
      }
      return items
    },
    [editor, titles, path]
  )

  return (
    <BlockNoteView
      editor={editor}
      theme={scheme}
      onChange={onChange}
      formattingToolbar={false}
      slashMenu={false}
      sideMenu={false}
      className="write-editor"
    >
      <FormattingToolbarController
        formattingToolbar={() => (
          <FormattingToolbar>
            {getFormattingToolbarItems().filter((el) => !HIDDEN_TOOLBAR.has(String(el.key)))}
            <BasicTextStyleButton basicTextStyle="code" key="codeStyleButton" />
            <HighlightButton key="highlightButton" />
          </FormattingToolbar>
        )}
      />
      <SideMenuController
        sideMenu={(props) => (
          <SideMenu
            {...props}
            dragHandleMenu={(p) => (
              <DragHandleMenu {...p}>
                <RemoveBlockItem>{dict.drag_handle.delete_menuitem}</RemoveBlockItem>
                <TableRowHeaderItem>{dict.drag_handle.header_row_menuitem}</TableRowHeaderItem>
                <TableColumnHeaderItem>
                  {dict.drag_handle.header_column_menuitem}
                </TableColumnHeaderItem>
              </DragHandleMenu>
            )}
          />
        )}
      />
      <SuggestionMenuController triggerCharacter="/" getItems={slashItems} />
      <SuggestionMenuController triggerCharacter="[[" getItems={linkItems} />
    </BlockNoteView>
  )
})

/** Text marker in the formatting toolbar, next to bold/italic/strike/code. */
function HighlightButton(): React.JSX.Element | null {
  const Components = useComponentsContext()!
  const editor = useBlockNoteEditor<
    WriteEditor['schema']['blockSchema'],
    WriteEditor['schema']['inlineContentSchema'],
    WriteEditor['schema']['styleSchema']
  >()
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed.isEditable) return undefined
      const blocks = ed.getSelection()?.blocks ?? [ed.getTextCursorPosition().block]
      if (!blocks.some((b) => b.content !== undefined)) return undefined
      return { active: 'highlight' in ed.getActiveStyles() }
    }
  })
  if (!state) return null
  const label = t('editor.highlight')
  return (
    <Components.FormattingToolbar.Button
      className="bn-button"
      data-test="highlight"
      label={label}
      mainTooltip={label}
      secondaryTooltip="⌃⌘H"
      isSelected={state.active}
      icon={<HighlighterIcon size={18} />}
      onClick={() => {
        editor.focus()
        editor.toggleStyles({ highlight: true })
      }}
    />
  )
}

function collectText(blocks: Block[]): string {
  return blocks.map((b) => plainText(b.content) + ' ' + collectText(b.children)).join(' ')
}

function replaceOrInsert(editor: WriteEditor, block: Record<string, unknown>): void {
  const cur = editor.getTextCursorPosition().block
  const empty = Array.isArray(cur.content) && cur.content.length === 0
  if (empty) editor.updateBlock(cur, block as never)
  else editor.insertBlocks([block as never], cur, 'after')
  const target = empty ? editor.getBlock(cur.id) : editor.getTextCursorPosition().nextBlock
  if (target) editor.setTextCursorPosition(target, 'end')
}

const MARKDOWN_BLOCK = /^ {0,3}(#{1,6}\s|([-*+]|\d+\.)\s|>|```|~~~|\|.*\|\s*$)/m
const MARKDOWN_INLINE = /(\*\*|__|==|~~)\S|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|\[\[/

/**
 * Whether pasted text should be read as markdown. Next to HTML only clear markdown syntax
 * counts, so rich text from a web page keeps its formatting; plain text with several lines is
 * read as markdown too, since that is what the editor's own files are.
 */
function looksLikeMarkdown(text: string, plainOnly: boolean): boolean {
  if (MARKDOWN_BLOCK.test(text) || MARKDOWN_INLINE.test(text)) return true
  return plainOnly && text.includes('\n')
}

function insertBlocksAtCursor(editor: WriteEditor, blocks: Block[]): void {
  if (!blocks.length) return
  const cur = editor.getTextCursorPosition().block
  editor.insertBlocks(blocks as never, cur, 'after')
  if (Array.isArray(cur.content) && cur.content.length === 0 && cur.type === 'paragraph')
    editor.removeBlocks([cur])
}

function useTemplates(): { name: string; path: string }[] {
  const vaultId = useStore((s) => s.vault?.current?.id)
  const [list, setList] = useState<{ name: string; path: string }[]>([])
  const load = useCallback(() => {
    if (vaultId) void invoke('templates:list').then(setList, () => setList([]))
  }, [vaultId])
  useEffect(load, [load])
  useIpcEvent('templates:changed', load)
  return list
}
