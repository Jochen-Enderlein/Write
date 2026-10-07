/**
 * A structural subset of BlockNote's block JSON. The converter only depends on these shapes, so it
 * runs in Node tests and in the main process without pulling in the editor.
 */

export type Styles = { bold?: true; italic?: true; strike?: true; code?: true; highlight?: true }

export interface StyledText {
  type: 'text'
  text: string
  styles: Styles
}

export interface LinkInline {
  type: 'link'
  href: string
  content: StyledText[]
}

export interface WikiLinkInline {
  type: 'wikilink'
  /** `embed` marks Obsidian-style `![[…]]` transclusions. */
  props: { target: string; alias: string; embed?: boolean }
  content?: undefined
}

/** Inline markdown we cannot represent (reference links, inline HTML, footnote refs …), kept verbatim. */
export interface RawInline {
  type: 'rawInline'
  props: { markdown: string }
  content?: undefined
}

/** A footnote reference `[^label]`; the note itself is a `footnote` block. */
export interface FootnoteRefInline {
  type: 'footnoteRef'
  props: { label: string }
  content?: undefined
}

/** Inline math `$…$` (LaTeX). */
export interface InlineMathInline {
  type: 'inlineMath'
  props: { latex: string }
  content?: undefined
}

export type Inline =
  StyledText | LinkInline | WikiLinkInline | RawInline | FootnoteRefInline | InlineMathInline

export type Alignment = 'left' | 'center' | 'right' | 'justify'

export interface TableCell {
  type: 'tableCell'
  content: Inline[]
  props: { textAlignment: Alignment; backgroundColor?: string; textColor?: string }
}

export interface TableContent {
  type: 'tableContent'
  columnWidths: (number | undefined)[]
  headerRows?: number
  rows: { cells: TableCell[] | Inline[][] }[]
}

export interface Block {
  id?: string
  type: string
  props: Record<string, unknown>
  content?: Inline[] | string | TableContent
  children: Block[]
}

export const CALLOUT_KINDS = [
  'note',
  'info',
  'tip',
  'success',
  'question',
  'warning',
  'danger',
  'important',
  'caution',
  'todo',
  'example',
  'quote'
] as const

export const LIST_TYPES = new Set(['bulletListItem', 'numberedListItem', 'checkListItem'])

export function listFamily(type: string): 'bullet' | 'ordered' | null {
  if (type === 'bulletListItem' || type === 'checkListItem') return 'bullet'
  if (type === 'numberedListItem') return 'ordered'
  return null
}

export function inlineContent(b: Block): Inline[] {
  return Array.isArray(b.content) ? (b.content as Inline[]) : []
}

export function plainText(content: Block['content']): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return (content as Inline[])
    .map((n) => {
      if (n.type === 'text') return n.text
      if (n.type === 'link') return n.content.map((c) => c.text).join('')
      if (n.type === 'wikilink') return n.props.alias || n.props.target
      if (n.type === 'footnoteRef') return ''
      if (n.type === 'inlineMath') return n.props.latex
      return n.props.markdown
    })
    .join('')
}

export function isEmptyParagraph(b: Block): boolean {
  return b.type === 'paragraph' && plainText(b.content) === '' && b.children.length === 0
}

/** Stable JSON of a block without ids – used to detect untouched blocks. */
export function fingerprint(b: Block): string {
  return stableStringify(stripIds(b))
}

function stripIds(b: Block): unknown {
  const { id: _id, children, ...rest } = b
  return { ...rest, children: children.map(stripIds) }
}

function stableStringify(v: unknown): string {
  if (v === undefined) return 'null'
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  const o = v as Record<string, unknown>
  return (
    '{' +
    Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + stableStringify(o[k]))
      .join(',') +
    '}'
  )
}

/** Running number of each top-level numbered list item (null for other blocks). */
export function listOrdinals(blocks: Block[]): (number | null)[] {
  const out: (number | null)[] = []
  let next = 1
  let prev: string | null = null
  for (const b of blocks) {
    if (b.type === 'numberedListItem') {
      const start = typeof b.props.start === 'number' ? b.props.start : undefined
      if (prev !== 'numberedListItem') next = start ?? 1
      else if (start !== undefined) next = start
      out.push(next++)
    } else out.push(null)
    prev = b.type
  }
  return out
}
