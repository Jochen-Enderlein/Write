/** Scores how well `query` matches `text` (higher is better, 0 = no match). */
export function fuzzyScore(text: string, query: string): number {
  const t = text.toLowerCase()
  const q = query.toLowerCase().trim()
  if (!q) return 1
  if (t === q) return 1000
  if (t.startsWith(q)) return 800 - t.length
  const word = t.search(new RegExp(`(^|[\\s\\-_/.(])${escape(q)}`))
  if (word >= 0) return 600 - word
  const idx = t.indexOf(q)
  if (idx >= 0) return 400 - idx
  // Subsequence: every query character appears in order
  let pos = 0
  let gaps = 0
  for (const ch of q) {
    const found = t.indexOf(ch, pos)
    if (found === -1) return 0
    gaps += found - pos
    pos = found + 1
  }
  return Math.max(1, 200 - gaps * 4)
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
