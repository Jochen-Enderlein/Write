/**
 * Where the reader was on each page (scroll offset, caret), so going back to a page continues
 * there instead of at the top. Kept for this window's session only.
 */
export interface PagePosition {
  scroll?: number
  /** ProseMirror selection in the rich editor. */
  caret?: { anchor: number; head: number; size: number }
  /** The editor had focus when the page was left, so it gets it back. */
  focused?: boolean
}

const LIMIT = 200
const positions = new Map<string, PagePosition>()

export function readPosition(path: string): PagePosition | undefined {
  return positions.get(path)
}

export function writePosition(path: string, patch: PagePosition): void {
  const next = { ...positions.get(path), ...patch }
  // Re-insert so the map stays ordered by last use and the oldest entry goes first
  positions.delete(path)
  positions.set(path, next)
  if (positions.size > LIMIT) positions.delete(positions.keys().next().value!)
}
