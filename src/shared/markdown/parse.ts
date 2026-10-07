import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type {
  Blockquote,
  Code,
  FootnoteDefinition,
  Heading,
  List,
  ListItem,
  Node as MdNode,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Table
} from 'mdast'
import { WIKILINK_RE } from '../wikilinks'
import type { Alignment, Block, Inline, StyledText, Styles, TableCell } from './blocks'

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath)

export interface Origin {
  id: string
  /** Index among the top-level blocks of the original document */
  index: number
  start: number
  end: number
}

export interface ParsedBody {
  body: string
  blocks: Block[]
  origins: Origin[]
  /** Whitespace between consecutive origins: gaps[i] sits between origins[i] and origins[i+1]. */
  gaps: string[]
  prefix: string
  suffix: string
}

const AUDIO_EXT = /\.(mp3|m4a|wav|ogg|flac|aac)$/i
const VIDEO_EXT = /\.(mp4|mov|webm|m4v)$/i
const CALLOUT_RE = /^\[!([A-Za-z][\w-]*)\]([+-]?)[ \t]*/

export function parseMarkdownBody(body: string, makeId: () => string): ParsedBody {
  const tree = processor.parse(body) as Root
  const ctx = new Ctx(body, makeId)
  const blocks: Block[] = []
  const origins: Origin[] = []

  const add = (block: Block, node: MdNode): void => {
    const start = node.position?.start.offset ?? 0
    const end = node.position?.end.offset ?? start
    origins.push({ id: block.id!, index: origins.length, start, end })
    blocks.push(block)
  }

  for (const node of tree.children) {
    if (node.type === 'list') {
      for (const item of node.children)
        add(ctx.listItem(node, item, node.children.indexOf(item)), item)
    } else {
      add(ctx.flow(node), node)
    }
  }

  const gaps: string[] = []
  for (let i = 0; i + 1 < origins.length; i++)
    gaps.push(body.slice(origins[i]!.end, origins[i + 1]!.start))
  const prefix = origins.length ? body.slice(0, origins[0]!.start) : ''
  const suffix = origins.length ? body.slice(origins[origins.length - 1]!.end) : body
  return { body, blocks, origins, gaps, prefix, suffix }
}

/** Parses markdown into blocks without keeping source positions (templates, pasted text). */
export function markdownToBlocks(body: string, makeId: () => string): Block[] {
  return parseMarkdownBody(body, makeId).blocks
}

class Ctx {
  constructor(
    readonly src: string,
    readonly makeId: () => string
  ) {}

  slice(node: MdNode): string {
    const s = node.position?.start.offset
    const e = node.position?.end.offset
    return s === undefined || e === undefined ? '' : this.src.slice(s, e)
  }

  block(
    type: string,
    props: Record<string, unknown>,
    content?: Block['content'],
    children: Block[] = []
  ): Block {
    const b: Block = { id: this.makeId(), type, props, children }
    if (content !== undefined) b.content = content
    return b
  }

  raw(node: MdNode): Block {
    return this.block('rawMarkdown', { markdown: this.slice(node) })
  }

  flowList(nodes: RootContent[]): Block[] {
    const out: Block[] = []
    for (const n of nodes) {
      if (n.type === 'list') n.children.forEach((item, i) => out.push(this.listItem(n, item, i)))
      else out.push(this.flow(n))
    }
    return out
  }

  flow(node: RootContent): Block {
    switch (node.type) {
      case 'paragraph':
        return this.paragraph(node)
      case 'heading':
        return this.heading(node)
      case 'thematicBreak':
        return this.block('divider', {})
      case 'code':
        return this.code(node)
      case 'blockquote':
        return this.blockquote(node)
      case 'table':
        return this.table(node)
      case 'list':
        // Only reached for nested contexts that want a single block; callers normally expand lists.
        return node.children[0] ? this.listItem(node, node.children[0], 0) : this.raw(node)
      case 'math':
        // Only the plain fenced form; `$$ meta` or unusual fences stay verbatim
        return !node.meta && /^\$\$[ \t]*\n[\s\S]*\n[ \t]*\$\$$/.test(this.slice(node))
          ? this.block('math', { source: node.value })
          : this.raw(node)
      case 'footnoteDefinition':
        return this.footnote(node)
      default:
        // html, definitions, footnotes, math … are kept exactly as written
        return this.raw(node)
    }
  }

  paragraph(node: Paragraph): Block {
    const kids = node.children.filter((c) => !(c.type === 'text' && c.value.trim() === ''))
    const only = kids.length === 1 ? kids[0] : undefined
    if (only?.type === 'image' && !only.title) {
      const url = only.url
      const type = AUDIO_EXT.test(url) ? 'audio' : VIDEO_EXT.test(url) ? 'video' : 'image'
      return this.block(type, { url, caption: only.alt ?? '' })
    }
    if (
      only?.type === 'link' &&
      !only.title &&
      /(^|\/)_assets\//.test(only.url) &&
      only.children.every((c) => c.type === 'text')
    ) {
      const name = only.children.map((c) => (c.type === 'text' ? c.value : '')).join('')
      return this.block('file', { url: only.url, name })
    }
    return this.block('paragraph', {}, this.inline(node.children))
  }

  /** `[^1]: Text` with a single paragraph becomes an editable note; anything longer stays verbatim. */
  footnote(node: FootnoteDefinition): Block {
    const [only, ...rest] = node.children
    if (!only || rest.length || only.type !== 'paragraph') return this.raw(node)
    return this.block(
      'footnote',
      { label: node.label ?? node.identifier },
      this.inline(only.children)
    )
  }

  heading(node: Heading): Block {
    // Setext headings (underlined) can't be reproduced; keep them verbatim.
    if (/\n[=-]+\s*$/.test(this.slice(node))) return this.raw(node)
    return this.block('heading', { level: node.depth }, this.inline(node.children))
  }

  code(node: Code): Block {
    if (node.meta) return this.raw(node)
    // Indented code blocks have no fence; keep their exact form.
    if (!/^ {0,3}(`{3,}|~{3,})/.test(this.slice(node))) return this.raw(node)
    return this.block('codeBlock', { language: node.lang || 'text' }, node.value)
  }

  blockquote(node: Blockquote): Block {
    const [first, ...rest] = node.children
    if (!first || first.type !== 'paragraph') return this.raw(node)
    const content = this.inline(first.children)
    const head = content[0]
    const marker =
      head?.type === 'text' && head.styles && Object.keys(head.styles).length === 0
        ? CALLOUT_RE.exec(head.text)
        : null
    if (head && marker) {
      // `[!note] Titel\nInhalt` – the title runs up to the first line break
      const afterMarker: Inline[] = [
        {
          ...(head as StyledText),
          text: head.type === 'text' ? head.text.slice(marker[0].length) : ''
        },
        ...content.slice(1)
      ]
      const { title, body } = splitFirstLine(afterMarker)
      return this.block(
        'callout',
        { kind: marker[1]!.toLowerCase(), title, fold: marker[2] ?? '' },
        body,
        this.flowList(rest)
      )
    }
    return this.block('quote', {}, content, this.flowList(rest))
  }

  listItem(list: List, item: ListItem, indexInList: number): Block {
    const [first, ...rest] = item.children
    const hasPara = first?.type === 'paragraph'
    const content = hasPara ? this.inline(first.children) : []
    const children = this.flowList(hasPara ? rest : item.children)
    if (typeof item.checked === 'boolean') {
      return this.block('checkListItem', { checked: item.checked }, content, children)
    }
    if (list.ordered) {
      const props: Record<string, unknown> = {}
      if (indexInList === 0 && typeof list.start === 'number' && list.start !== 1)
        props.start = list.start
      return this.block('numberedListItem', props, content, children)
    }
    return this.block('bulletListItem', {}, content, children)
  }

  table(node: Table): Block {
    const align = node.align ?? []
    const rows = node.children.map((row) => ({
      cells: row.children.map((cell, i): TableCell => ({
        type: 'tableCell',
        content: this.inline(cell.children),
        props: { textAlignment: (align[i] ?? 'left') as Alignment }
      }))
    }))
    const cols = Math.max(0, ...rows.map((r) => r.cells.length))
    return this.block(
      'table',
      {},
      {
        type: 'tableContent',
        columnWidths: Array.from({ length: cols }, () => undefined),
        headerRows: 1,
        rows
      }
    )
  }

  /** Inline content of one block: phrasing plus `==highlights==`, which may span formatting. */
  inline(nodes: PhrasingContent[]): Inline[] {
    return applyHighlights(this.phrasing(nodes))
  }

  phrasing(nodes: PhrasingContent[], styles: Styles = {}): Inline[] {
    const out: Inline[] = []
    for (const n of nodes) {
      switch (n.type) {
        case 'text':
          pushText(out, markEscapedEquals(this.slice(n), n.value), styles)
          break
        case 'emphasis':
          out.push(...this.phrasing(n.children, { ...styles, italic: true }))
          break
        case 'strong':
          out.push(...this.phrasing(n.children, { ...styles, bold: true }))
          break
        case 'delete':
          out.push(...this.phrasing(n.children, { ...styles, strike: true }))
          break
        case 'inlineCode':
          pushStyled(out, n.value, { ...styles, code: true })
          break
        case 'break':
          pushStyled(out, '\n', styles)
          break
        case 'link': {
          const simple =
            !n.title &&
            n.children.every((c) =>
              ['text', 'emphasis', 'strong', 'delete', 'inlineCode'].includes(c.type)
            )
          if (!simple) {
            out.push({ type: 'rawInline', props: { markdown: this.slice(n) } })
            break
          }
          const content = this.phrasing(n.children, styles).filter(
            (c): c is StyledText => c.type === 'text'
          )
          out.push({ type: 'link', href: n.url, content })
          break
        }
        case 'footnoteReference':
          out.push({ type: 'footnoteRef', props: { label: n.label ?? n.identifier } })
          break
        case 'inlineMath': {
          const source = this.slice(n)
          const next = this.src[n.position?.end.offset ?? 0] ?? ''
          // Obsidian's rule: `$x$` without spaces inside the dollars and no digit right after,
          // so prices like "$5 and $10" stay text
          if (/^\$(?!\$)\S(?:[\s\S]*\S)?\$$/.test(source) && !/\d/.test(next))
            out.push({ type: 'inlineMath', props: { latex: n.value } })
          else pushText(out, source, styles)
          break
        }
        default:
          out.push({ type: 'rawInline', props: { markdown: this.slice(n) } })
      }
    }
    return mergeTexts(out)
  }
}

// ── Highlights ────────────────────────────────────────────────────────────────

/**
 * `\=` in the source is a literal equals sign that must never open or close a highlight. While
 * parsing it stands in as this private-use character and turns back into `=` afterwards.
 */
const ESCAPED_EQ = ''
/** Stand-in for inline content a highlight can surround but not split (code, wiki links …). */
const OPAQUE = '￼'
/** Obsidian's `==mark==`: no whitespace just inside the markers, like `**bold**`. */
const HIGHLIGHT_RE = /==(?=[^\s=])([\s\S]*?[^\s=])==/g

/** Replaces escaped `=` in a text node's value by ESCAPED_EQ, using its source slice. */
function markEscapedEquals(raw: string, value: string): string {
  if (!raw.includes('\\=')) return value
  let out = ''
  let i = 0
  let j = 0
  while (i < raw.length && j < value.length) {
    if (raw[i] === '\\' && raw[i + 1] === value[j] && /[!-/:-@[-`{-~]/.test(value[j]!)) {
      out += value[j] === '=' ? ESCAPED_EQ : value[j]
      i += 2
      j++
    } else if (raw[i] === value[j]) {
      out += value[j]
      i++
      j++
    } else return value // entities or other rewrites: leave the text as it is
  }
  return j === value.length ? out : value
}

type Unit = { text: StyledText; container: number } | { opaque: Inline | StyledText }

/**
 * Finds `==…==` across the styled runs of one block. Markers live in plain text; code, wiki
 * links and raw markdown can sit inside a highlight but never contain a marker.
 */
function applyHighlights(content: Inline[]): Inline[] {
  const units: Unit[] = []
  content.forEach((n, i) => {
    if (n.type === 'text') units.push(n.styles.code ? { opaque: n } : { text: n, container: -1 })
    else if (n.type === 'link')
      n.content.forEach((t) =>
        units.push(t.styles.code ? { opaque: t } : { text: t, container: i })
      )
    else units.push({ opaque: n })
  })

  // One string over all units, remembering where each character came from
  let joined = ''
  const owner: number[] = []
  units.forEach((u, k) => {
    const s = 'text' in u ? u.text.text : OPAQUE
    joined += s
    for (let c = 0; c < s.length; c++) owner.push(k)
  })
  if (!joined.includes('==')) return restoreEquals(content)

  const drop = new Set<number>()
  const lit = new Set<number>()
  for (const m of joined.matchAll(HIGHLIGHT_RE)) {
    const open = m.index!
    const close = open + m[0].length - 2
    const container = (at: number): number | null => {
      const u = units[owner[at]!]!
      return 'text' in u ? u.container : null
    }
    // Both markers in plain text of the same level (not one inside a link and one outside)
    const a = container(open)
    if (
      a === null ||
      a !== container(open + 1) ||
      a !== container(close) ||
      a !== container(close + 1)
    )
      continue
    drop
      .add(open)
      .add(open + 1)
      .add(close)
      .add(close + 1)
    for (let c = open + 2; c < close; c++) lit.add(c)
  }
  if (!drop.size) return restoreEquals(content)

  // Rebuild each text run, split where the highlight starts or ends
  const rebuilt = new Map<StyledText | Inline, StyledText[]>()
  let pos = 0
  for (const u of units) {
    if (!('text' in u)) {
      const o = u.opaque
      if (lit.has(pos) && o.type === 'text')
        rebuilt.set(o, [{ ...o, styles: { ...o.styles, highlight: true } }])
      pos++
      continue
    }
    const pieces: StyledText[] = []
    const t = u.text
    for (let c = 0; c < t.text.length; c++, pos++) {
      if (drop.has(pos)) continue
      const styles: Styles = lit.has(pos) ? { ...t.styles, highlight: true } : t.styles
      const last = pieces[pieces.length - 1]
      if (last && Boolean(last.styles.highlight) === Boolean(styles.highlight))
        last.text += t.text[c]
      else pieces.push({ type: 'text', text: t.text[c]!, styles: { ...styles } })
    }
    rebuilt.set(t, pieces)
  }

  const out: Inline[] = []
  for (const n of content) {
    if (n.type === 'link')
      out.push({ ...n, content: n.content.flatMap((t) => rebuilt.get(t) ?? [t]) })
    else if (n.type === 'text') out.push(...(rebuilt.get(n) ?? [n]))
    else out.push(n)
  }
  return restoreEquals(mergeTexts(out))
}

function restoreEquals(content: Inline[]): Inline[] {
  const fix = (t: StyledText): StyledText =>
    t.text.includes(ESCAPED_EQ) ? { ...t, text: t.text.replaceAll(ESCAPED_EQ, '=') } : t
  return content.map((n) =>
    n.type === 'text'
      ? fix(n)
      : n.type === 'link'
        ? { ...n, content: mergeTexts(n.content.map(fix)) as StyledText[] }
        : n
  )
}

function pushText(out: Inline[], value: string, styles: Styles): void {
  let i = 0
  for (const m of value.matchAll(WIKILINK_RE)) {
    const embed = m.index! > i && value[m.index! - 1] === '!'
    const start = embed ? m.index! - 1 : m.index!
    if (start > i) pushStyled(out, value.slice(i, start), styles)
    const props = { target: m[1]!.trim(), alias: (m[2] ?? '').trim() }
    out.push({ type: 'wikilink', props: embed ? { ...props, embed: true } : props })
    i = m.index! + m[0].length
  }
  if (i < value.length) pushStyled(out, value.slice(i), styles)
}

function pushStyled(out: Inline[], text: string, styles: Styles): void {
  if (text) out.push({ type: 'text', text, styles: { ...styles } })
}

function sameStyles(a: Styles, b: Styles): boolean {
  const ka = Object.keys(a).sort().join()
  return ka === Object.keys(b).sort().join()
}

function mergeTexts(nodes: Inline[]): Inline[] {
  const out: Inline[] = []
  for (const n of nodes) {
    const prev = out[out.length - 1]
    if (n.type === 'text' && prev?.type === 'text' && sameStyles(prev.styles, n.styles)) {
      out[out.length - 1] = { ...prev, text: prev.text + n.text }
    } else out.push(n)
  }
  return out
}

function splitFirstLine(content: Inline[]): { title: string; body: Inline[] } {
  let title = ''
  for (let i = 0; i < content.length; i++) {
    const n = content[i]!
    const text =
      n.type === 'text'
        ? n.text
        : n.type === 'link'
          ? n.content.map((c) => c.text).join('')
          : n.type === 'wikilink'
            ? `${n.props.embed ? '!' : ''}[[${n.props.target}${n.props.alias ? '|' + n.props.alias : ''}]]`
            : n.type === 'footnoteRef'
              ? `[^${n.props.label}]`
              : n.type === 'inlineMath'
                ? `$${n.props.latex}$`
                : n.props.markdown
    const nl = n.type === 'text' ? n.text.indexOf('\n') : -1
    if (nl === -1) {
      title += text
      continue
    }
    title += text.slice(0, nl)
    const restText = (n as StyledText).text.slice(nl + 1)
    const body: Inline[] = []
    if (restText) body.push({ ...(n as StyledText), text: restText })
    body.push(...content.slice(i + 1))
    return { title: title.trim(), body: mergeTexts(body) }
  }
  return { title: title.trim(), body: [] }
}
