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
import {
  createReactBlockSpec,
  createReactInlineContentSpec,
  useEditorState
} from '@blocknote/react'
import { useEffect, useRef, useState } from 'react'
import { CALLOUT_KINDS } from '@shared/markdown'
import { IMAGE_EXT_RE, linkLabel, parseLinkTarget } from '@shared/wikilinks'
import { t } from '../i18n'
import { renderMermaid } from './mermaid'
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

/** Mermaid diagram: rendered preview, source editable below while the cursor is inside. */
export const Mermaid = createReactBlockSpec(
  { type: 'mermaid', propSchema: {}, content: 'plain' },
  {
    render: function Render({ block, editor, contentRef }) {
      const source = Array.isArray(block.content)
        ? block.content.map((c) => ('text' in c ? c.text : '')).join('')
        : ''
      const preview = useRef<HTMLDivElement>(null)
      const active = useEditorState({
        editor,
        selector: ({ editor: ed }) => {
          try {
            return ed.getTextCursorPosition().block.id === block.id
          } catch {
            return false
          }
        }
      })
      useEffect(() => {
        const el = preview.current
        if (!el) return
        const id = setTimeout(() => {
          el.classList.remove('error')
          void renderMermaid(source, el)
        }, 250)
        return () => clearTimeout(id)
      }, [source])
      return (
        <div className={`mermaid-block ${active ? 'active' : ''}`}>
          <div
            className="mermaid-preview"
            ref={preview}
            contentEditable={false}
            onMouseDown={(e) => {
              // Pressing the diagram opens its source for editing
              e.preventDefault()
              editor.setTextCursorPosition(block, 'end')
              editor.focus()
            }}
          />
          <div className="mermaid-label" contentEditable={false}>
            Mermaid
          </div>
          <pre className="mermaid-source">
            <code ref={contentRef} />
          </pre>
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
      out = { ...b, type: 'mermaid', props: {} }
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
