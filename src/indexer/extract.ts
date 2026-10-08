import { splitFrontmatter, stringField, tagsField } from '@shared/frontmatter'
import { stemOf } from '@shared/paths'
import { propertiesOf, type PropValue } from '@shared/properties'
import { extractTasks, type Task } from '@shared/tasks'
import { extractTags, extractWikilinks, normalizeTitle } from '@shared/wikilinks'

export interface ExtractedPage {
  id: string | null
  title: string
  icon: string | null
  tags: string[]
  links: string[]
  text: string
  props: Record<string, PropValue>
  tasks: Task[]
}

/** Fast, regex-based extraction for the index. No full markdown parse needed here. */
export function extractPage(path: string, raw: string): ExtractedPage {
  const { data, body } = splitFrontmatter(raw)
  const title = stringField(data, 'title') ?? stemOf(path)
  const tags = new Set([
    ...tagsField(data).map((t) => t.toLowerCase().replace(/^#/, '')),
    ...extractTags(body)
  ])
  const links = [...new Set(extractWikilinks(body).map(normalizeTitle))]
  return {
    id: stringField(data, 'id'),
    title,
    icon: stringField(data, 'icon'),
    tags: [...tags],
    links,
    text: plainText(body),
    props: propertiesOf(data),
    tasks: extractTasks(raw)
  }
}

/** Strips markdown syntax so snippets read like prose. */
export function plainText(md: string): string {
  return md
    .replace(/^```.*$/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(
      /^\s{0,3}(#{1,6}\s+|>\s?(\[![^\]]+\][+-]?\s*)?|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/gm,
      ''
    )
    .replace(/[*_~`]+/g, '')
    .replace(/==([^=\s](?:[^=]*?[^=\s])?)==/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/[ \t]+/g, ' ')
}
