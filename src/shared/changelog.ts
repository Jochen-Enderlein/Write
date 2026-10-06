/**
 * CHANGELOG.md is the single source of release notes: the release script refuses to publish a
 * version without an entry, the entry becomes the GitHub release text, and the app shows the
 * entries a user hasn't seen yet after updating.
 *
 * Format: one `## 0.2.0` (optionally `## [0.2.0] – 2026-10-07`) heading per version, newest
 * first; below it plain Markdown – `### Neu`, `- Punkte`, **fett**, `Code`.
 */

export interface ChangelogEntry {
  version: string
  date: string | null
  body: string
}

const HEADING = /^##\s+\[?v?(\d+\.\d+\.\d+(?:-[\w.]+)?)\]?(?:\s*[-–—]\s*(\S.*))?\s*$/

export function parseChangelog(md: string): ChangelogEntry[] {
  const out: ChangelogEntry[] = []
  let cur: ChangelogEntry | null = null
  const lines: string[] = []
  const close = (): void => {
    if (cur) out.push({ ...cur, body: lines.join('\n').trim() })
    lines.length = 0
  }
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    const m = HEADING.exec(line)
    if (m) {
      close()
      cur = { version: m[1]!, date: m[2]?.trim() || null, body: '' }
    } else if (/^##\s/.test(line)) {
      // "## Unveröffentlicht" and the like: not a release
      close()
      cur = null
    } else if (cur) lines.push(line)
  }
  close()
  return out
}

/** Numeric comparison of `major.minor.patch`; a pre-release sorts before its release. */
export function compareVersions(a: string, b: string): number {
  const [ma, pa] = a.split('-', 2)
  const [mb, pb] = b.split('-', 2)
  const na = ma!.split('.').map(Number)
  const nb = mb!.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (na[i] ?? 0) - (nb[i] ?? 0)
    if (d) return Math.sign(d)
  }
  if (pa === pb) return 0
  if (pa === undefined) return 1
  if (pb === undefined) return -1
  return pa < pb ? -1 : 1
}

/** Entries newer than `since` up to and including `current`, newest first. */
export function entriesSince(
  entries: ChangelogEntry[],
  since: string | null,
  current: string
): ChangelogEntry[] {
  return entries
    .filter(
      (e) =>
        compareVersions(e.version, current) <= 0 &&
        (since === null || compareVersions(e.version, since) > 0)
    )
    .sort((a, b) => compareVersions(b.version, a.version))
}
