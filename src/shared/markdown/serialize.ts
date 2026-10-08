import { unified } from 'unified'
import remarkStringify, { type Options as StringifyOptions } from 'remark-stringify'
import remarkGfm from 'remark-gfm'
import type {
  BlockContent,
  FootnoteDefinition,
  ListItem,
  PhrasingContent,
  Root,
  RootContent,
  TableRow
} from 'mdast'
import {
  type Block,
  type Inline,
  type StyledText,
  type Styles,
  type TableCell,
  fingerprint,
  isEmptyParagraph,
  listFamily,
  listOrdinals
} from './blocks'
import type { ParsedBody } from './parse'
import { TAG_RE, WIKILINK_RE } from '../wikilinks'

interface ListStyle {
  bullet?: '-' | '*' | '+'
  bulletOrdered?: '.' | ')'
}

const baseOptions: StringifyOptions = {
  bullet: '-',
  bulletOrdered: '.',
  emphasis: '*',
  strong: '*',
  fence: '`',
  fences: true,
  rule: '-',
  listItemIndent: 'one',
  incrementListMarker: true,
  tightDefinitions: true
}

function stringify(root: Root, style: ListStyle = {}): string {
  const proc = unified()
    .use(remarkStringify, { ...baseOptions, ...style })
    .use(remarkGfm)
  return proc.stringify(root).replace(/\n+$/, '')
}

/** What the editor looked like right after loading, used to write untouched blocks back verbatim. */
export interface Baseline {
  body: string
  prefix: string
  suffix: string
  gaps: string[]
  entries: Map<string, BaselineEntry>
}

interface BaselineEntry {
  index: number
  start: number
  end: number
  fingerprint: string
  ordinal: number | null
  listStyle: ListStyle
}

/**
 * Builds the baseline from the parse result and the editor's own view of the same blocks
 * (`editor.document` right after loading), so editor normalisation never counts as a change.
 */
export function createBaseline(parsed: ParsedBody, editorBlocks: Block[]): Baseline {
  const byId = new Map(parsed.origins.map((o) => [o.id, o]))
  const visible = editorBlocks.filter((b) => !isEmptyParagraph(b))
  const ordinals = listOrdinals(visible)
  const entries = new Map<string, BaselineEntry>()
  visible.forEach((b, i) => {
    const o = b.id ? byId.get(b.id) : undefined
    if (!o) return
    entries.set(b.id!, {
      index: o.index,
      start: o.start,
      end: o.end,
      fingerprint: fingerprint(b),
      ordinal: ordinals[i] ?? null,
      listStyle: listStyleOf(parsed.body.slice(o.start, o.end))
    })
  })
  return {
    body: parsed.body,
    prefix: parsed.prefix,
    suffix: parsed.suffix,
    gaps: parsed.gaps,
    entries
  }
}

function listStyleOf(source: string): ListStyle {
  const m = /^\s*(?:([-*+])|\d+([.)]))/.exec(source)
  if (!m) return {}
  if (m[1]) return { bullet: m[1] as ListStyle['bullet'] }
  return { bulletOrdered: m[2] as ListStyle['bulletOrdered'] }
}

/** Serialises the editor blocks; untouched blocks are copied byte-for-byte from the baseline. */
export function serializeBody(blocks: Block[], base: Baseline | null): string {
  const items = blocks.filter((b) => !isEmptyParagraph(b))
  if (items.length === 0) return base && base.entries.size === 0 ? base.body : ''
  const ordinals = listOrdinals(items)

  type Piece = { block: Block; text: string; entry: BaselineEntry | null; style: ListStyle }
  const pieces: Piece[] = []
  items.forEach((block, i) => {
    const entry = (block.id && base?.entries.get(block.id)) || null
    const ordinal = ordinals[i] ?? null
    const untouched =
      entry !== null &&
      entry.fingerprint === fingerprint(block) &&
      (block.type !== 'numberedListItem' || entry.ordinal === ordinal)
    if (untouched) {
      pieces.push({
        block,
        text: base!.body.slice(entry.start, entry.end),
        entry,
        style: entry.listStyle
      })
      return
    }
    let style = neighbourStyle(items, i, base)
    const prev = pieces[i - 1]
    if (prev && listFamily(prev.block.type) === listFamily(block.type) && listFamily(block.type)) {
      style = { ...prev.style, ...style }
    }
    if (startsNewOrderedList(block, prev?.block)) {
      // A different delimiter is the only way to end one ordered list and start the next.
      style = { bulletOrdered: prev!.style.bulletOrdered === ')' ? '.' : ')' }
    }
    pieces.push({
      block,
      text: serializeTopLevel(block, ordinal, style),
      entry: null,
      style: { bulletOrdered: '.', ...style }
    })
  })

  let out = base ? base.prefix : ''
  pieces.forEach((p, i) => {
    if (i > 0) {
      const prev = pieces[i - 1]!
      const adjacent = prev.entry && p.entry && p.entry.index === prev.entry.index + 1
      out += adjacent ? base!.gaps[prev.entry!.index]! : defaultSeparator(prev.block, p.block)
    }
    out += p.text
  })
  return out + (base ? base.suffix || (base.entries.size ? '' : '\n') : '\n')
}

function startsNewOrderedList(b: Block, prev: Block | undefined): boolean {
  return (
    b.type === 'numberedListItem' &&
    prev?.type === 'numberedListItem' &&
    typeof b.props.start === 'number'
  )
}

function defaultSeparator(a: Block, b: Block): string {
  const fa = listFamily(a.type)
  return fa !== null && fa === listFamily(b.type) ? '\n' : '\n\n'
}

/** Reuse the bullet character of an adjacent original list item so the list stays one list. */
function neighbourStyle(items: Block[], i: number, base: Baseline | null): ListStyle {
  if (!base) return {}
  const fam = listFamily(items[i]!.type)
  if (!fam) return {}
  for (const j of [i - 1, i + 1]) {
    const n = items[j]
    if (!n || listFamily(n.type) !== fam || !n.id) continue
    const e = base.entries.get(n.id)
    if (e) return e.listStyle
  }
  return {}
}

export function serializeTopLevel(
  block: Block,
  ordinal: number | null,
  style: ListStyle = {}
): string {
  const fam = listFamily(block.type)
  if (fam) {
    return stringify(
      {
        type: 'root',
        children: [
          {
            type: 'list',
            ordered: fam === 'ordered',
            start: fam === 'ordered' ? (ordinal ?? 1) : null,
            spread: false,
            children: [listItem(block)]
          }
        ]
      },
      style
    )
  }
  return stringify({ type: 'root', children: blockToFlow(block) as RootContent[] })
}

/** Serialises a list of blocks without baseline (templates, export, tests). */
export function blocksToMarkdown(blocks: Block[]): string {
  return serializeBody(blocks, null)
}

function blocksToFlow(blocks: Block[]): BlockContent[] {
  const out: BlockContent[] = []
  let i = 0
  const visible = blocks.filter((b) => !isEmptyParagraph(b))
  while (i < visible.length) {
    const b = visible[i]!
    const fam = listFamily(b.type)
    if (!fam) {
      out.push(...blockToFlow(b))
      i++
      continue
    }
    const items: ListItem[] = []
    const start = fam === 'ordered' && typeof b.props.start === 'number' ? b.props.start : 1
    items.push(listItem(visible[i++]!))
    while (
      i < visible.length &&
      listFamily(visible[i]!.type) === fam &&
      !startsNewOrderedList(visible[i]!, visible[i - 1])
    ) {
      items.push(listItem(visible[i++]!))
    }
    out.push({
      type: 'list',
      ordered: fam === 'ordered',
      start: fam === 'ordered' ? start : null,
      spread: false,
      children: items
    })
  }
  return out
}

function listItem(b: Block): ListItem {
  const content = inlineToPhrasing(asInline(b.content))
  const children: BlockContent[] = []
  if (content.length > 0 || b.children.length === 0)
    children.push({ type: 'paragraph', children: content })
  children.push(...blocksToFlow(b.children))
  return {
    type: 'listItem',
    spread: false,
    checked: b.type === 'checkListItem' ? Boolean(b.props.checked) : null,
    children
  }
}

function blockToFlow(b: Block): BlockContent[] {
  const own = ownFlow(b)
  // Markdown can't nest blocks under a paragraph or heading: children follow as siblings.
  return b.type === 'quote' || b.type === 'callout' ? own : [...own, ...blocksToFlow(b.children)]
}

function ownFlow(b: Block): BlockContent[] {
  const inline = (): PhrasingContent[] => inlineToPhrasing(asInline(b.content))
  switch (b.type) {
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(b.props.level) || 1)) as 1 | 2 | 3 | 4 | 5 | 6
      return [{ type: 'heading', depth: level, children: inline() }]
    }
    case 'divider':
      return [{ type: 'thematicBreak' }]
    case 'codeBlock': {
      const lang = String(b.props.language ?? 'text')
      return [
        { type: 'code', lang: lang === 'text' ? null : lang, meta: null, value: plain(b.content) }
      ]
    }
    case 'mermaid':
      return [{ type: 'code', lang: 'mermaid', meta: null, value: String(b.props.source ?? '') }]
    case 'dbTable':
      return [
        { type: 'code', lang: 'write-table', meta: null, value: String(b.props.source ?? '') }
      ]
    case 'quote':
      return [
        {
          type: 'blockquote',
          children: [{ type: 'paragraph', children: inline() }, ...blocksToFlow(b.children)]
        }
      ]
    case 'callout': {
      const kind = String(b.props.kind || 'note')
      const title = String(b.props.title ?? '')
      const marker = `[!${kind}]${String(b.props.fold ?? '')}${title ? ' ' + title : ''}`
      const body = inline()
      const first: PhrasingContent[] = [{ type: 'html', value: marker }]
      if (body.length) first.push({ type: 'text', value: '\n' }, ...body)
      return [
        {
          type: 'blockquote',
          children: [{ type: 'paragraph', children: first }, ...blocksToFlow(b.children)]
        }
      ]
    }
    case 'image':
    case 'video':
    case 'audio':
      return [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: String(b.props.url ?? ''),
              alt: String(b.props.caption ?? '') || null,
              title: null
            }
          ]
        }
      ]
    case 'file': {
      const url = String(b.props.url ?? '')
      const name = String(b.props.name ?? '') || decodeURIComponent(url.split('/').pop() ?? url)
      return [
        {
          type: 'paragraph',
          children: [{ type: 'link', url, title: null, children: [{ type: 'text', value: name }] }]
        }
      ]
    }
    case 'table':
      return [table(b)]
    case 'rawMarkdown':
      return [{ type: 'html', value: String(b.props.markdown ?? '') }]
    case 'math':
      return [{ type: 'html', value: `$$\n${String(b.props.source ?? '')}\n$$` }]
    case 'footnote': {
      const label = String(b.props.label ?? '')
      // A definition isn't flow content in mdast's types, but remark-gfm prints it in its place
      const def: FootnoteDefinition = {
        type: 'footnoteDefinition',
        identifier: label.toLowerCase(),
        label,
        children: [{ type: 'paragraph', children: inline() }]
      }
      return [def as unknown as BlockContent]
    }
    default:
      return [{ type: 'paragraph', children: inline() }]
  }
}

function table(b: Block): BlockContent {
  const content = b.content
  if (!content || typeof content === 'string' || Array.isArray(content))
    return { type: 'paragraph', children: [] }
  const rows = content.rows.map((r) => r.cells.map((c) => normalizeCell(c)))
  const cols = Math.max(1, ...rows.map((r) => r.length))
  const align = Array.from({ length: cols }, (_, i) => {
    const a = rows[0]?.[i]?.props.textAlignment
    return a === 'center' || a === 'right' ? a : null
  })
  const children: TableRow[] = rows.map((cells) => ({
    type: 'tableRow',
    children: Array.from({ length: cols }, (_, i) => ({
      type: 'tableCell' as const,
      children: inlineToPhrasing(cells[i]?.content ?? [], true)
    }))
  }))
  return { type: 'table', align, children }
}

function normalizeCell(c: TableCell | Inline[]): TableCell {
  return Array.isArray(c) ? { type: 'tableCell', content: c, props: { textAlignment: 'left' } } : c
}

function asInline(content: Block['content']): Inline[] {
  if (Array.isArray(content)) return content as Inline[]
  if (typeof content === 'string')
    return content ? [{ type: 'text', text: content, styles: {} }] : []
  return []
}

function plain(content: Block['content']): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content))
    return (content as Inline[]).map((n) => (n.type === 'text' ? n.text : '')).join('')
  return ''
}

// ── Inline ────────────────────────────────────────────────────────────────────

type WrapStyle = 'highlight' | 'bold' | 'italic' | 'strike'
/** Outermost first: `==**fett**==` reads more naturally than `**==fett==**`. */
const WRAP_ORDER: WrapStyle[] = ['highlight', 'bold', 'italic', 'strike']

type Item = { styles: Styles; node: PhrasingContent[] }

export function inlineToPhrasing(content: Inline[], inTable = false): PhrasingContent[] {
  const items: Item[] = []
  content.forEach((n, i) => {
    if (n.type === 'text') items.push(...textItems(n, inTable))
    else if (n.type === 'link') {
      // A fully marked link is written inside the marker: `==[Link](url)==`
      const marked = isMarked(n) === true
      const texts = marked ? n.content.map(unmark) : n.content
      items.push({
        styles: marked ? { highlight: true } : {},
        node: [
          {
            type: 'link',
            url: n.href,
            title: null,
            children: build(texts.flatMap((t) => textItems(t, inTable)))
          }
        ]
      })
    } else if (n.type === 'wikilink') {
      const alias = n.props.alias ? (inTable ? '\\|' : '|') + n.props.alias : ''
      const bang = n.props.embed ? '!' : ''
      items.push({
        styles: markedAround(content, i) ? { highlight: true } : {},
        node: [{ type: 'html', value: `${bang}[[${n.props.target}${alias}]]` }]
      })
    } else if (n.type === 'rawInline') {
      items.push({
        styles: markedAround(content, i) ? { highlight: true } : {},
        node: [{ type: 'html', value: n.props.markdown }]
      })
    } else if (n.type === 'footnoteRef' || n.type === 'inlineMath') {
      const value = n.type === 'footnoteRef' ? `[^${n.props.label}]` : `$${n.props.latex}$`
      items.push({
        styles: markedAround(content, i) ? { highlight: true } : {},
        node: [{ type: 'html', value }]
      })
    }
  })
  return build(items)
}

/** Whether inline content carries the text marker; null for content that can't (wiki links …). */
function isMarked(n: Inline): boolean | null {
  if (n.type === 'text') return Boolean(n.styles?.highlight)
  if (n.type === 'link') return n.content.length > 0 && n.content.every((t) => t.styles?.highlight)
  return null
}

/** Wiki links and raw markdown inside a marked passage stay inside one `==…==`. */
function markedAround(content: Inline[], i: number): boolean {
  const find = (step: 1 | -1): boolean => {
    for (let j = i + step; j >= 0 && j < content.length; j += step) {
      const m = isMarked(content[j]!)
      if (m !== null) return m
    }
    return false
  }
  return find(-1) && find(1)
}

function unmark(t: StyledText): StyledText {
  const { highlight: _drop, ...styles } = t.styles ?? {}
  return { ...t, styles }
}

/** Turns a styled run into an item; emphasis wrapping happens later in `build`. */
function textItems(t: StyledText, inTable: boolean): Item[] {
  const styles = t.styles ?? {}
  if (!t.text) return []
  if (styles.code) return [{ styles, node: [{ type: 'inlineCode', value: t.text }] }]
  const node: PhrasingContent[] = []
  // Line breaks stay plain newlines (soft breaks), which most editors show as line breaks.
  const lines = inTable ? t.text.split('\n') : [t.text]
  lines.forEach((line, i) => {
    if (i > 0) node.push({ type: 'html', value: '<br>' })
    node.push(...protectSyntax(line))
  })
  return [{ styles, node }]
}

/** Typed `[[Wiki-Links]]` and `#tags` must reach the file unescaped. */
function protectSyntax(text: string): PhrasingContent[] {
  const out: PhrasingContent[] = []
  const re = new RegExp(`${WIKILINK_RE.source}|${TAG_RE.source}`, 'gu')
  let i = 0
  for (const m of text.matchAll(re)) {
    const isTag = m[0].includes('#') && !m[0].startsWith('[[')
    const lead = isTag ? (m[3] ?? '') : ''
    const start = m.index! + lead.length
    if (start > i) out.push({ type: 'text', value: text.slice(i, start) })
    out.push({ type: 'html', value: m[0].slice(lead.length) })
    i = m.index! + m[0].length
  }
  if (i < text.length) out.push({ type: 'text', value: text.slice(i) })
  return out.flatMap((n) => (n.type === 'text' ? escapeHighlightMarkers(n.value) : [n]))
}

/**
 * A typed `==` that could open or close a highlight (`a==b`) is written as `\==`, so it stays
 * literal text. `x == y` with spaces around can't be a marker and is left alone.
 */
function escapeHighlightMarkers(text: string): PhrasingContent[] {
  const out: PhrasingContent[] = []
  let i = 0
  for (const m of text.matchAll(/==/g)) {
    const at = m.index!
    const before = text[at - 1]
    const after = text[at + 2]
    const opens = after !== undefined && !/[\s=]/.test(after)
    const closes = before !== undefined && !/[\s=]/.test(before)
    // At the edge of a run the neighbour is unknown, so treat it as a possible marker
    if (!opens && !closes && before !== undefined && after !== undefined) continue
    if (at < i) continue
    if (at > i) out.push({ type: 'text', value: text.slice(i, at) })
    out.push({ type: 'html', value: '\\=' }, { type: 'text', value: '=' })
    i = at + 2
  }
  if (i < text.length) out.push({ type: 'text', value: text.slice(i) })
  return out
}

function build(items: Item[]): PhrasingContent[] {
  const out: PhrasingContent[] = []
  let i = 0
  while (i < items.length) {
    const it = items[i]!
    const s = WRAP_ORDER.find((k) => it.styles[k])
    if (!s) {
      out.push(...it.node)
      i++
      continue
    }
    let j = i
    while (j < items.length && items[j]!.styles[s]) j++
    const inner = items.slice(i, j).map((x) => {
      const { [s]: _drop, ...rest } = x.styles
      return { styles: rest, node: x.node }
    })
    const { lead, children, trail } = peelWhitespace(build(inner))
    if (lead) out.push({ type: 'text', value: lead })
    if (children.length) {
      if (s === 'highlight')
        out.push({ type: 'html', value: '==' }, ...children, { type: 'html', value: '==' })
      else if (s === 'bold') out.push({ type: 'strong', children })
      else if (s === 'italic') out.push({ type: 'emphasis', children })
      else out.push({ type: 'delete', children })
    }
    if (trail) out.push({ type: 'text', value: trail })
    i = j
  }
  return out
}

/** `** fett **` is not bold in Markdown: whitespace at the edges moves outside the markers. */
function peelWhitespace(children: PhrasingContent[]): {
  lead: string
  children: PhrasingContent[]
  trail: string
} {
  const kids = [...children]
  let lead = ''
  let trail = ''
  const first = kids[0]
  if (first?.type === 'text') {
    const m = /^\s+/.exec(first.value)
    if (m) {
      lead = m[0]
      const rest = first.value.slice(lead.length)
      if (rest) kids[0] = { ...first, value: rest }
      else kids.shift()
    }
  }
  const last = kids[kids.length - 1]
  if (last?.type === 'text') {
    const m = /\s+$/.exec(last.value)
    if (m) {
      trail = m[0]
      const rest = last.value.slice(0, -trail.length)
      if (rest) kids[kids.length - 1] = { ...last, value: rest }
      else kids.pop()
    }
  }
  return { lead, children: kids, trail }
}
