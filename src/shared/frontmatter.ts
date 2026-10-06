import YAML from 'yaml'

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n?---[ \t]*(?:\r?\n|$)/

export interface SplitPage {
  /** The raw frontmatter block including both `---` lines and the trailing newline, or ''. */
  raw: string
  data: Record<string, unknown>
  body: string
}

export function splitFrontmatter(text: string): SplitPage {
  const m = FM_RE.exec(text)
  if (!m) return { raw: '', data: {}, body: text }
  let data: Record<string, unknown> = {}
  try {
    const parsed = YAML.parse(m[1] ?? '')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed
  } catch {
    // Broken YAML stays untouched in `raw`; we just don't read fields from it.
  }
  return { raw: m[0], data, body: text.slice(m[0].length) }
}

/**
 * Applies field changes to an existing frontmatter block while keeping order, comments and
 * formatting of untouched fields. `undefined` removes a field.
 */
export function updateFrontmatter(raw: string, changes: Record<string, unknown>): string {
  const m = FM_RE.exec(raw)
  const inner = m ? (m[1] ?? '') : ''
  const doc = YAML.parseDocument(inner)
  if (doc.errors.length > 0) return raw || buildFrontmatter(changes)
  if (!doc.contents) doc.contents = doc.createNode({}) as never
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined) doc.delete(k)
    else doc.set(k, v)
  }
  const out = doc.toString({ lineWidth: 0, flowCollectionPadding: false }).replace(/\n$/, '')
  return `---\n${out}\n---\n`
}

export function buildFrontmatter(fields: Record<string, unknown>): string {
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined))
  const doc = new YAML.Document(clean)
  // Tag lists read nicer inline: tags: [a, b]
  const tags = doc.get('tags', true)
  if (YAML.isSeq(tags)) tags.flow = true
  const out = doc.toString({ lineWidth: 0, flowCollectionPadding: false }).replace(/\n$/, '')
  return `---\n${out}\n---\n`
}

export function stringField(data: Record<string, unknown>, key: string): string | null {
  const v = data[key]
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return null
}

export function tagsField(data: Record<string, unknown>): string[] {
  const v = data.tags
  if (Array.isArray(v))
    return v.filter((t) => typeof t === 'string' || typeof t === 'number').map(String)
  if (typeof v === 'string') return v.split(/[,\s]+/).filter(Boolean)
  return []
}
