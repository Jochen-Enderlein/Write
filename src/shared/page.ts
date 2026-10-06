import { ulid } from 'ulid'
import { buildFrontmatter, splitFrontmatter, stringField, updateFrontmatter } from './frontmatter'
import { isoLocal } from './dates'
import { stemOf } from './paths'

export interface PageHeader {
  raw: string
  data: Record<string, unknown>
  id: string | null
  title: string
  icon: string | null
}

export function readHeader(path: string, text: string): PageHeader & { body: string } {
  const { raw, data, body } = splitFrontmatter(text)
  return {
    raw,
    data,
    body,
    id: stringField(data, 'id'),
    title: stringField(data, 'title') ?? stemOf(path),
    icon: stringField(data, 'icon')
  }
}

/** Frontmatter for a brand-new page. */
export function newPageFrontmatter(title: string, extra: Record<string, unknown> = {}): string {
  const now = isoLocal()
  return buildFrontmatter({ id: ulid(), title, created: now, updated: now, ...extra })
}

/**
 * Combines frontmatter and a changed body. Bumps `updated` and adds missing `id`/`title`/`created`
 * (pages created outside the app get them on their first edit).
 */
export function composePage(header: PageHeader, path: string, body: string): string {
  const now = isoLocal()
  const changes: Record<string, unknown> = { updated: now }
  if (!header.id) changes.id = ulid()
  if (!stringField(header.data, 'title')) changes.title = header.title || stemOf(path)
  if (!stringField(header.data, 'created')) changes.created = now
  const fm = header.raw
    ? updateFrontmatter(header.raw, changes)
    : buildFrontmatter({
        id: changes.id,
        title: changes.title,
        created: changes.created,
        updated: now
      })
  return fm + body
}
