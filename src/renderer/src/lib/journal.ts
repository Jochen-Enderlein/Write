import { JOURNAL_DIR } from '@shared/paths'
import type { PageMeta } from '@shared/types'

const DAY_RE = new RegExp(`^${JOURNAL_DIR}/(\\d{4}-\\d{2}-\\d{2})\\.md$`)

/** `Journal/2026-10-05.md` → `2026-10-05`, else null. */
export function journalDayOf(path: string): string | null {
  return DAY_RE.exec(path)?.[1] ?? null
}

/** All days that have a journal page, ascending. */
export function journalDays(titles: PageMeta[]): string[] {
  return titles
    .map((m) => journalDayOf(m.path))
    .filter((d): d is string => d !== null)
    .sort()
}

/** The existing entry before (`-1`) or after (`1`) `day`, or null. */
export function adjacentDay(days: string[], day: string, dir: 1 | -1): string | null {
  if (dir < 0) {
    for (let i = days.length - 1; i >= 0; i--) if (days[i]! < day) return days[i]!
    return null
  }
  for (const d of days) if (d > day) return d
  return null
}

/** Parses `2026-10-05` as a local date. */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}
