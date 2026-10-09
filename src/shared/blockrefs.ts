/**
 * Obsidian-style block references: a block gets an id by ending with ` ^id` (or, after lists,
 * quotes and tables, by a line `^id` of its own), and `[[Seite#^id]]` links to or embeds it.
 */

/** ` ^id` at the end of a line or text; the id itself is group 1. */
export const BLOCK_ID_RE = /(?:^|\s)\^([A-Za-z0-9-]+)\s*$/

/** The block id a line or block text ends with, or null. */
export function blockIdOf(text: string): string | null {
  return BLOCK_ID_RE.exec(text)?.[1] ?? null
}

/** Text without its trailing ` ^id`. */
export function stripBlockId(text: string): string {
  return text.replace(BLOCK_ID_RE, '')
}

/** A short random id like Obsidian's (`^3f9a2c`). */
export function newBlockId(): string {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0')
}

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s/
const HEADING = /^\s{0,3}#{1,6}\s/
const FENCE = /^\s{0,3}(`{3,}|~{3,})/

/** Indices of the lines that are not inside fenced code. */
function proseLines(lines: string[]): number[] {
  const out: number[] = []
  let fence: string | null = null
  lines.forEach((line, i) => {
    const f = FENCE.exec(line)
    if (f) {
      if (!fence) fence = f[1]![0]!
      else if (f[1]![0] === fence) fence = null
      return
    }
    if (!fence) out.push(i)
  })
  return out
}

/** Index of the line carrying `^id` (outside code), or -1. */
export function blockLine(body: string, id: string): number {
  const want = id.toLowerCase()
  const lines = body.split('\n')
  return proseLines(lines).find((i) => blockIdOf(lines[i]!)?.toLowerCase() === want) ?? -1
}

/**
 * The Markdown of the block `^id` points to, without the marker: the paragraph, heading or list
 * item (with its nested items) ending in ` ^id`, or the block right above a line `^id` of its
 * own. Null if no block carries the id.
 */
export function blockSection(body: string, id: string): string | null {
  const lines = body.split('\n')
  const at = blockLine(body, id)
  if (at === -1) return null
  const line = lines[at]!
  let from = at
  let to = at
  if (line.trim().startsWith('^')) {
    // `^id` on its own line names the block above it
    to = at - 1
    while (to >= 0 && !lines[to]!.trim()) to--
    if (to < 0) return null
    from = to
    if (FENCE.test(lines[to]!)) {
      // A code block, blank lines and all, back to its opening fence
      do from--
      while (from > 0 && !FENCE.test(lines[from]!))
    } else while (from > 0 && lines[from - 1]!.trim()) from--
  } else if (LIST_ITEM.test(line)) {
    const indent = LIST_ITEM.exec(line)![1]!.length
    while (to + 1 < lines.length) {
      const next = lines[to + 1]!
      if (!next.trim() || /^\s*/.exec(next)![0].length <= indent) break
      to++
    }
  } else if (!HEADING.test(line)) {
    while (
      from > 0 &&
      lines[from - 1]!.trim() &&
      !HEADING.test(lines[from - 1]!) &&
      !LIST_ITEM.test(lines[from - 1]!) &&
      !FENCE.test(lines[from - 1]!)
    )
      from--
  }
  return lines
    .slice(from, to + 1)
    .map((l) => stripBlockId(l))
    .join('\n')
}

/**
 * Which of the editor's blocks (in document order) `^id` points to: the one whose text ends with
 * it, or – for a paragraph that is only `^id` – the block before.
 */
export function matchBlockRef(blocks: { id: string; text: string }[], id: string): string | null {
  const want = id.toLowerCase()
  const i = blocks.findIndex((b) => blockIdOf(b.text)?.toLowerCase() === want)
  if (i === -1) return null
  if (blocks[i]!.text.trim().startsWith('^') && i > 0) return blocks[i - 1]!.id
  return blocks[i]!.id
}

/** Section of a page body below `heading` up to the next heading of the same or a higher level. */
export function headingSection(body: string, heading: string): string {
  const lines = body.split('\n')
  const want = heading.trim().toLowerCase()
  const start = lines.findIndex((l) => {
    const m = /^(#{1,6})\s+(.*)$/.exec(l)
    return m && m[2]!.trim().toLowerCase() === want
  })
  if (start === -1) return body
  const level = /^(#{1,6})/.exec(lines[start]!)![1]!.length
  const end = lines.findIndex(
    (l, i) => i > start && /^(#{1,6})\s/.test(l) && /^(#{1,6})/.exec(l)![1]!.length <= level
  )
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n')
}
