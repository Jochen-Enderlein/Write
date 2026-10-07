import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { scrollBehavior } from '../lib/motion'

export interface Match {
  from: number
  to: number
}

/** What the find bar needs from an editor; the rich and the Markdown editor both provide it. */
export interface FindTarget {
  find(query: string, matchCase: boolean): Match[]
  highlight(matches: Match[], current: number): void
  clear(): void
  reveal(m: Match | undefined): void
  select(m: Match | undefined): void
  replace(m: Match, text: string): void
  replaceAll(matches: Match[], text: string): number
}

/** Find and replace in the rich (ProseMirror) editor. */
export function proseMirrorFind(view: EditorView): FindTarget {
  return {
    find: (q, c) => findMatches(view, q, c),
    highlight: (m, i) => highlight(view, m, i),
    clear: clearHighlight,
    reveal: (m) => revealMatch(view, m),
    select: (m) => selectMatch(view, m),
    replace: (m, t) => replaceMatch(view, m, t),
    replaceAll: (m, t) => replaceAll(view, m, t)
  }
}

const HL_ALL = 'write-find'
const HL_CURRENT = 'write-find-current'

/**
 * Finds `query` in every text block of the document. Inside a text block, positions map 1:1 to
 * characters (text) or to one placeholder (inline atoms like wiki links), so a match at string
 * index `i` starts at `blockPos + 1 + i`.
 */
export function findMatches(view: EditorView, query: string, matchCase: boolean): Match[] {
  if (!query) return []
  const needle = matchCase ? query : query.toLocaleLowerCase()
  const out: Match[] = []
  view.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    let text = ''
    node.forEach((child) => {
      text += child.isText ? child.text! : '￼'.repeat(child.nodeSize)
    })
    const hay = matchCase ? text : text.toLocaleLowerCase()
    let i = hay.indexOf(needle)
    while (i !== -1) {
      out.push({ from: pos + 1 + i, to: pos + 1 + i + needle.length })
      i = hay.indexOf(needle, i + Math.max(1, needle.length))
    }
    return false
  })
  return out
}

function toRange(view: EditorView, m: Match): Range | null {
  try {
    const a = view.domAtPos(m.from)
    const b = view.domAtPos(m.to)
    const r = document.createRange()
    r.setStart(a.node, a.offset)
    r.setEnd(b.node, b.offset)
    return r
  } catch {
    return null
  }
}

/** Marks all matches and the current one with the CSS Custom Highlight API (no DOM changes). */
export function highlight(view: EditorView, matches: Match[], current: number): void {
  if (typeof CSS === 'undefined' || !('highlights' in CSS)) return
  const ranges = matches.map((m) => toRange(view, m)).filter((r): r is Range => r !== null)
  CSS.highlights.set(HL_ALL, new Highlight(...ranges))
  const cur = matches[current] && toRange(view, matches[current])
  if (cur) CSS.highlights.set(HL_CURRENT, new Highlight(cur))
  else CSS.highlights.delete(HL_CURRENT)
}

export function clearHighlight(): void {
  if (typeof CSS === 'undefined' || !('highlights' in CSS)) return
  CSS.highlights.delete(HL_ALL)
  CSS.highlights.delete(HL_CURRENT)
}

export function revealMatch(view: EditorView, m: Match | undefined): void {
  if (!m) return
  try {
    const { node } = view.domAtPos(m.from)
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)
    el?.scrollIntoView({ block: 'center', behavior: scrollBehavior() })
  } catch {
    // position no longer in the document
  }
}

/** Puts the editor selection on a match (when the find bar closes). */
export function selectMatch(view: EditorView, m: Match | undefined): void {
  if (!m) return
  try {
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, m.from, m.to)))
    view.focus()
  } catch {
    // stale match
  }
}

export function replaceMatch(view: EditorView, m: Match, text: string): void {
  const tr = text
    ? view.state.tr.insertText(text, m.from, m.to)
    : view.state.tr.delete(m.from, m.to)
  view.dispatch(tr)
}

/** Replaces all matches in one transaction (one undo step). Returns how many were replaced. */
export function replaceAll(view: EditorView, matches: Match[], text: string): number {
  if (!matches.length) return 0
  let tr = view.state.tr
  for (const m of [...matches].reverse())
    tr = text ? tr.insertText(text, m.from, m.to) : tr.delete(m.from, m.to)
  view.dispatch(tr)
  return matches.length
}
