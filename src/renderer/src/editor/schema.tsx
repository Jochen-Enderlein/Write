import {
  BlockNoteSchema,
  createCodeBlockSpec,
  createHeadingBlockSpec,
  defaultBlockSpecs,
  createStyleSpecFromTipTapMark,
  defaultInlineContentSpecs,
  defaultStyleSpecs
} from '@blocknote/core'
import { Mark, markInputRule, markPasteRule } from '@tiptap/core'
import { codeBlockOptions } from '@blocknote/code-block'
import { createReactBlockSpec, createReactInlineContentSpec } from '@blocknote/react'
import { useEffect, useRef, useState } from 'react'
import { CALLOUT_KINDS } from '@shared/markdown'
import { IMAGE_EXT_RE, linkLabel, parseLinkTarget } from '@shared/wikilinks'
import { t } from '../i18n'
import { renderMermaid } from './mermaid'
import { editForKey } from './codeIndent'
import { editorBridge } from './bridge'

export const CALLOUT_ICONS: Record<string, string> = {
  note: '✎',
  info: 'ℹ',
  tip: '✦',
  success: '✓',
  question: '?',
  warning: '!',
  danger: '⚡',
  important: '❖',
  caution: '⚠',
  todo: '☐',
  example: '❡',
  quote: '❝'
}

/** Obsidian-style callout: `> [!note] Titel` */
export const Callout = createReactBlockSpec(
  {
    type: 'callout',
    propSchema: { kind: { default: 'note' }, title: { default: '' }, fold: { default: '' } },
    content: 'inline'
  },
  {
    render: ({ block, editor, contentRef }) => {
      const kind = String(block.props.kind)
      const known = (CALLOUT_KINDS as readonly string[]).includes(kind)
      return (
        <div className="callout" data-kind={known ? kind : 'note'}>
          <div className="callout-head" contentEditable={false}>
            <label
              className="callout-kind"
              title={t(`editor.calloutKinds.${known ? kind : 'note'}`)}
            >
              <span aria-hidden="true">{CALLOUT_ICONS[kind] ?? CALLOUT_ICONS.note}</span>
              <select
                value={kind}
                onChange={(e) => editor.updateBlock(block, { props: { kind: e.target.value } })}
                aria-label={t('editor.callout')}
              >
                {!known && <option value={kind}>{kind}</option>}
                {CALLOUT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`editor.calloutKinds.${k}`)}
                  </option>
                ))}
              </select>
            </label>
            <input
              className="callout-title"
              value={String(block.props.title)}
              placeholder={t(`editor.calloutKinds.${known ? kind : 'note'}`)}
              onChange={(e) => editor.updateBlock(block, { props: { title: e.target.value } })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  editor.setTextCursorPosition(block, 'end')
                  editor.focus()
                }
              }}
            />
          </div>
          <div className="callout-body" ref={contentRef} />
        </div>
      )
    }
  }
)

/** Markdown the editor cannot represent; kept verbatim and editable as source. */
export const RawMarkdown = createReactBlockSpec(
  { type: 'rawMarkdown', propSchema: { markdown: { default: '' } }, content: 'none' },
  {
    render: function Render({ block, editor }) {
      const [editing, setEditing] = useState(false)
      const ref = useRef<HTMLTextAreaElement>(null)
      useEffect(() => {
        if (editing && ref.current) {
          ref.current.focus()
          ref.current.style.height = ref.current.scrollHeight + 'px'
        }
      }, [editing])
      const markdown = String(block.props.markdown)
      return (
        <div className="raw-md" contentEditable={false} onDoubleClick={() => setEditing(true)}>
          <div className="raw-md-label" title={t('editor.rawHint')}>
            {t('editor.raw')}
          </div>
          {editing ? (
            <textarea
              ref={ref}
              defaultValue={markdown}
              spellCheck={false}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = el.scrollHeight + 'px'
              }}
              onBlur={(e) => {
                setEditing(false)
                if (e.currentTarget.value !== markdown)
                  editor.updateBlock(block, { props: { markdown: e.currentTarget.value } })
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') e.currentTarget.blur()
              }}
            />
          ) : (
            <pre>{markdown}</pre>
          )}
        </div>
      )
    }
  }
)

function LinkChip({ target, alias }: { target: string; alias: string }): React.JSX.Element {
  const exists = editorBridge.useTitleExists(target)
  return (
    <span
      className={exists ? 'wikilink' : 'wikilink missing'}
      title={exists ? target : t('editor.missingPage')}
      onMouseDown={(e) => {
        // Navigate on press for immediate feedback; keep the editor from moving the caret
        if (e.button !== 0) return
        e.preventDefault()
        editorBridge.openTitle(target)
      }}
    >
      {alias || linkLabel(target)}
    </span>
  )
}

/** `![[Bild.png]]`: the image itself, resolved like Obsidian (next to the page, then anywhere). */
function EmbedImage({ target, alias }: { target: string; alias: string }): React.JSX.Element {
  const [url, setUrl] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    void editorBridge.resolveImage(target).then((u) => live && setUrl(u))
    return () => {
      live = false
    }
  }, [target])
  if (url === null)
    return <span className="embed-missing">{t('editor.embedMissing', { target })}</span>
  // Obsidian uses the alias as width (`![[bild.png|300]]`)
  const width = /^\d+$/.test(alias) ? Number(alias) : undefined
  return (
    <span className="embed-image" contentEditable={false}>
      {url && <img src={url} alt={alias && !width ? alias : target} width={width} />}
    </span>
  )
}

/** `![[Seite]]` / `![[Seite#Abschnitt]]`: a read-only preview of the other page. */
function EmbedPage({ target }: { target: string }): React.JSX.Element {
  const [page, setPage] = useState<Awaited<ReturnType<typeof editorBridge.loadPage>> | undefined>(
    undefined
  )
  useEffect(() => {
    let live = true
    void editorBridge.loadPage(target).then((p) => live && setPage(p))
    return () => {
      live = false
    }
  }, [target])
  if (page === null)
    return <span className="embed-missing">{t('editor.embedMissing', { target })}</span>
  const heading = parseLinkTarget(target).heading
  return (
    <span className="embed-page" contentEditable={false}>
      <span
        className="embed-page-title"
        title={t('editor.embedOpen')}
        onMouseDown={(e) => {
          if (e.button !== 0) return
          e.preventDefault()
          editorBridge.openTitle(target)
        }}
      >
        {page?.title ?? linkLabel(target)}
        {heading ? ` › ${heading}` : ''}
      </span>
      <span className="embed-page-text">{page?.text ?? ''}</span>
    </span>
  )
}

export const WikiLink = createReactInlineContentSpec(
  {
    type: 'wikilink',
    propSchema: { target: { default: '' }, alias: { default: '' }, embed: { default: false } },
    content: 'none'
  },
  {
    render: ({ inlineContent }) => {
      const target = String(inlineContent.props.target)
      const alias = String(inlineContent.props.alias)
      if (!inlineContent.props.embed) return <LinkChip target={target} alias={alias} />
      if (IMAGE_EXT_RE.test(parseLinkTarget(target).page))
        return <EmbedImage target={target} alias={alias} />
      return <EmbedPage target={target} />
    }
  }
)

export const RawInline = createReactInlineContentSpec(
  { type: 'rawInline', propSchema: { markdown: { default: '' } }, content: 'none' },
  {
    render: ({ inlineContent }) => (
      <code className="raw-inline" title={t('editor.rawHint')}>
        {String(inlineContent.props.markdown)}
      </code>
    )
  }
)

/** Languages without bundled highlighting that still deserve a real code block. */
const PLAIN_LANGUAGES: Record<string, { name: string; aliases?: string[] }> = {
  toml: { name: 'TOML' },
  ini: { name: 'INI' },
  diff: { name: 'Diff', aliases: ['patch'] },
  dockerfile: { name: 'Dockerfile', aliases: ['docker'] },
  makefile: { name: 'Makefile', aliases: ['make'] },
  go: { name: 'Go', aliases: ['golang'] },
  dart: { name: 'Dart' },
  perl: { name: 'Perl' },
  powershell: { name: 'PowerShell', aliases: ['ps1'] },
  objc: { name: 'Objective-C', aliases: ['objective-c'] },
  csv: { name: 'CSV' },
  plaintext: { name: 'Klartext', aliases: ['txt', 'plain'] }
}

export const SUPPORTED_LANGUAGES = {
  ...PLAIN_LANGUAGES,
  ...codeBlockOptions.supportedLanguages
} as Record<string, { name: string; aliases?: string[] }>

/** Mermaid blocks whose code panel should open once they render (freshly inserted ones). */
const openOnMount = new Set<string>()
export function openMermaidEditor(id: string): void {
  openOnMount.add(id)
}

/**
 * Mermaid diagram: the page shows only the rendered graph. The source lives in a prop and is
 * edited in a plain text field that folds out beside the graph, so typing never runs through
 * the rich-text editor (which would split lines into new blocks and swallow indentation).
 */
export const Mermaid = createReactBlockSpec(
  { type: 'mermaid', propSchema: { source: { default: '' } }, content: 'none' },
  {
    render: function Render({ block, editor }) {
      const source = String(block.props.source)
      const [open, setOpen] = useState(() => openOnMount.delete(block.id))
      const [draft, setDraft] = useState(source)
      const [svg, setSvg] = useState('')
      const [error, setError] = useState('')
      const field = useRef<HTMLTextAreaElement>(null)
      const commitTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
      const caret = useRef<[number, number] | null>(null)

      // Changes from outside (undo, a reload from disk) replace the draft unless it is ahead
      const committed = useRef(source)
      useEffect(() => {
        if (source !== committed.current) {
          committed.current = source
          setDraft(source)
        }
      }, [source])

      useEffect(() => {
        let stale = false
        const id = setTimeout(() => {
          if (!draft.trim()) {
            setSvg('')
            setError('')
            return
          }
          void renderMermaid(draft).then((res) => {
            if (stale) return
            // While typing, a half-written graph keeps the last good drawing
            if ('svg' in res) {
              setSvg(res.svg)
              setError('')
            } else setError(res.error)
          })
        }, 250)
        return () => {
          stale = true
          clearTimeout(id)
        }
      }, [draft])

      const commit = (text: string): void => {
        clearTimeout(commitTimer.current)
        commitTimer.current = setTimeout(() => {
          if (text === committed.current || !editor.getBlock(block.id)) return
          committed.current = text
          editor.updateBlock(block.id, { props: { source: text } } as never)
        }, 300)
      }
      useEffect(() => () => clearTimeout(commitTimer.current), [])

      const change = (text: string): void => {
        setDraft(text)
        commit(text)
      }

      // Keep the caret where an indentation edit put it once React has rendered the new text
      useEffect(() => {
        const el = field.current
        if (el && caret.current) {
          el.setSelectionRange(...caret.current)
          caret.current = null
        }
        if (el) {
          el.style.height = 'auto'
          el.style.height = `${el.scrollHeight}px`
        }
      }, [draft, open])

      useEffect(() => {
        if (open) field.current?.focus()
      }, [open])

      return (
        <div className={`mermaid-block ${open ? 'open' : ''}`} contentEditable={false}>
          <div
            className={`mermaid-preview ${error && !svg ? 'error' : ''}`}
            onDoubleClick={() => setOpen(true)}
          >
            {svg ? (
              <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />
            ) : (
              error || (!draft.trim() && <span className="mermaid-empty">Mermaid</span>)
            )}
          </div>
          {open && (
            <div className="mermaid-code">
              <div className="mermaid-label">Mermaid</div>
              <textarea
                ref={field}
                className="mermaid-input"
                value={draft}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                onChange={(e) => change(e.target.value)}
                onBlur={() => {
                  clearTimeout(commitTimer.current)
                  if (draft !== committed.current) {
                    committed.current = draft
                    editor.updateBlock(block.id, { props: { source: draft } } as never)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setOpen(false)
                    return
                  }
                  const key =
                    e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey
                      ? 'Enter'
                      : e.key === 'Tab'
                        ? e.shiftKey
                          ? 'Shift-Tab'
                          : 'Tab'
                        : null
                  if (!key || (key === 'Enter' && e.shiftKey)) return
                  const el = e.currentTarget
                  const edit = editForKey(key, el.value, el.selectionStart, el.selectionEnd)
                  if (!edit) return
                  e.preventDefault()
                  caret.current = [edit.start, edit.end]
                  change(edit.text)
                }}
              />
              {error && svg && <div className="mermaid-error">{error}</div>}
            </div>
          )}
          <button
            type="button"
            className="mermaid-toggle"
            title={open ? t('editor.mermaidHideCode') : t('editor.mermaidEditCode')}
            aria-pressed={open}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen((o) => !o)}
          >
            {'</>'}
          </button>
        </div>
      )
    }
  }
)

const codeBlock = createCodeBlockSpec({
  ...codeBlockOptions,
  supportedLanguages: {
    ...SUPPORTED_LANGUAGES
  }
})

const {
  paragraph,
  bulletListItem,
  numberedListItem,
  checkListItem,
  quote,
  table,
  image,
  video,
  audio,
  file,
  divider
} = defaultBlockSpecs

/**
 * Only blocks that have a Markdown form. Toggle lists, colors, underline and alignment are left
 * out on purpose so nothing in the editor can silently get lost on save.
 */
/**
 * Text marker, stored as Obsidian's `==mark==`. ⌃⌘H toggles it (⇧⌘Y would collide with the macOS Stickies service); typing `==text==` marks the text
 * as you go, like `**bold**` does. Pasted `<mark>` keeps its highlight.
 */
const HighlightMark = Mark.create({
  name: 'highlight',
  parseHTML: () => [{ tag: 'mark' }],
  renderHTML: () => ['mark', { class: 'write-mark' }, 0],
  addKeyboardShortcuts() {
    return { 'Mod-Ctrl-h': () => this.editor.commands.toggleMark(this.name) }
  },
  addInputRules() {
    return [markInputRule({ find: /(?:^|\s)(==([^=\s](?:[^=]*?[^=\s])?)==)$/, type: this.type })]
  },
  addPasteRules() {
    return [markPasteRule({ find: /==([^=\s](?:[^=]*?[^=\s])?)==/g, type: this.type })]
  }
})

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph,
    heading: createHeadingBlockSpec({ levels: [1, 2, 3, 4, 5, 6], allowToggleHeadings: false }),
    bulletListItem,
    numberedListItem,
    checkListItem,
    quote,
    codeBlock,
    table,
    image,
    video,
    audio,
    file,
    divider,
    callout: Callout(),
    rawMarkdown: RawMarkdown(),
    mermaid: Mermaid()
  },
  inlineContentSpecs: {
    text: defaultInlineContentSpecs.text,
    link: defaultInlineContentSpecs.link,
    wikilink: WikiLink,
    rawInline: RawInline
  },
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    strike: defaultStyleSpecs.strike,
    code: defaultStyleSpecs.code,
    highlight: createStyleSpecFromTipTapMark(HighlightMark, 'boolean')
  }
})

export type WriteSchema = typeof schema
export type WriteEditor = typeof schema.BlockNoteEditor

/**
 * Adapts parsed blocks to what this editor can show: language aliases (`ts`) become their
 * canonical key, code in unknown languages stays verbatim as a Markdown block.
 */
export function prepareBlocks<
  B extends { type: string; props: Record<string, unknown>; children: B[] }
>(blocks: B[]): B[] {
  const byAlias = new Map<string, string>()
  for (const [key, def] of Object.entries(SUPPORTED_LANGUAGES)) {
    byAlias.set(key, key)
    for (const a of def.aliases ?? []) byAlias.set(a.toLowerCase(), key)
  }
  const fix = (b: B): B => {
    let out = b
    if (b.type === 'codeBlock' && String(b.props.language).toLowerCase() === 'mermaid') {
      const content = (b as { content?: unknown }).content
      const source =
        typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content.map((c: { text?: string }) => c.text ?? '').join('')
            : ''
      out = { ...b, type: 'mermaid', props: { source }, content: undefined }
    } else if (b.type === 'codeBlock') {
      const lang = String(b.props.language ?? 'text')
      const key = byAlias.get(lang.toLowerCase())
      if (key && key !== lang) out = { ...b, props: { ...b.props, language: key } }
      if (!key) {
        const code =
          typeof (b as { content?: unknown }).content === 'string'
            ? String((b as { content?: unknown }).content)
            : ''
        const fence = code.includes('```') ? '~~~~' : '```'
        out = {
          ...b,
          type: 'rawMarkdown',
          props: { markdown: `${fence}${lang}\n${code}\n${fence}` },
          content: undefined
        }
      }
    }
    return out.children.length ? { ...out, children: out.children.map(fix) } : out
  }
  return blocks.map(fix)
}
