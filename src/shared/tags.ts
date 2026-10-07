import { splitFrontmatter, tagsField, updateFrontmatter } from './frontmatter'
import { TAG_RE, mapOutsideCode } from './wikilinks'

/** Normalised tag name as the index stores it: lower case, without `#`. */
export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, '').toLowerCase()
}

/** Valid as a tag name (what `#…` in the text recognises). */
export function isValidTag(tag: string): boolean {
  return /^[\p{L}_][\p{L}\p{N}_\-/]*$/u.test(tag) && !tag.endsWith('/') && !tag.includes('//')
}

/** `from` itself or one of its nested tags (`projekt` covers `projekt/write`). */
function renamed(tag: string, from: string, to: string): string | null {
  const lower = tag.toLowerCase()
  if (lower === from) return to
  if (lower.startsWith(from + '/')) return to + tag.slice(from.length)
  return null
}

/**
 * Renames a tag and its nested tags in a page: in the frontmatter `tags` and as `#tag` in the
 * text, but not inside code. Returns the text unchanged when the tag isn't used.
 */
export function renameTagInText(text: string, fromTag: string, toTag: string): string {
  const from = normalizeTag(fromTag)
  const to = toTag.trim().replace(/^#/, '')
  const { raw, data, body } = splitFrontmatter(text)

  let fm = raw
  const tags = tagsField(data)
  if (tags.some((t) => renamed(t.replace(/^#/, ''), from, to) !== null)) {
    const next = [
      ...new Set(tags.map((t) => renamed(t.replace(/^#/, ''), from, to) ?? t.replace(/^#/, '')))
    ]
    fm = updateFrontmatter(raw, { tags: next })
  }

  const nextBody = mapOutsideCode(body, (chunk) =>
    chunk.replace(TAG_RE, (all, lead: string, tag: string) => {
      const r = renamed(tag, from, to)
      return r === null ? all : `${lead}#${r}`
    })
  )
  return fm + nextBody
}

export interface TagNode {
  /** Full name, e.g. `projekt/write` */
  tag: string
  /** Last part, e.g. `write` */
  name: string
  /** Pages with exactly this tag */
  count: number
  children: TagNode[]
}

/** Builds the nesting of `a/b/c` tags; parents that only exist through children get count 0. */
export function tagTree(tags: { tag: string; count: number }[]): TagNode[] {
  const roots: TagNode[] = []
  const byName = new Map<string, TagNode>()
  const node = (full: string): TagNode => {
    let n = byName.get(full)
    if (n) return n
    const cut = full.lastIndexOf('/')
    n = { tag: full, name: full.slice(cut + 1), count: 0, children: [] }
    byName.set(full, n)
    if (cut === -1) roots.push(n)
    else node(full.slice(0, cut)).children.push(n)
    return n
  }
  for (const t of tags) node(t.tag).count = t.count
  const sort = (list: TagNode[]): void => {
    list.sort((a, b) => a.name.localeCompare(b.name))
    list.forEach((n) => sort(n.children))
  }
  sort(roots)
  return roots
}
