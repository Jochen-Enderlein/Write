/**
 * Conflict copies written by sync clients, e.g.
 *  - Dropbox:   `Seite (Jochens conflicted copy 2026-10-05).md`
 *  - Nextcloud: `Seite (conflicted copy 2026-10-05 103045).md`
 *  - German:    `Seite (Konfliktkopie …).md`
 */
const CONFLICT_RE =
  /\s\((?:[^()]*\s)?(?:conflicted copy|konfliktkopie|in konflikt stehende kopie)[^()]*\)(?=\.md$)/i

export function isConflictCopy(path: string): boolean {
  return CONFLICT_RE.test(path)
}

export function originalOfConflict(path: string): string {
  return path.replace(CONFLICT_RE, '')
}

/** iCloud placeholder for an evicted file: `dir/.Name.md.icloud` → `dir/Name.md` */
export function icloudTarget(path: string): string | null {
  const m = /(^|\/)\.([^/]+)\.icloud$/.exec(path)
  if (!m) return null
  return path.slice(0, m.index) + (m[1] ?? '') + m[2]
}
