import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { splitFrontmatter } from '@shared/frontmatter'
import {
  type Block,
  blocksToMarkdown,
  createBaseline,
  fingerprint,
  parseMarkdownBody,
  serializeBody
} from '@shared/markdown'

const dir = join(__dirname, '../fixtures/roundtrip')
const fixtures = readdirSync(dir).filter((f) => f.endsWith('.md'))

function ids(): () => string {
  let n = 0
  return () => `b${++n}`
}

const strip = (bs: Block[]): string[] => bs.map(fingerprint)

describe.each(fixtures)('%s', (name) => {
  const text = readFileSync(join(dir, name), 'utf8')
  const { raw, body } = splitFrontmatter(text)

  it('bleibt nach Laden und Speichern byte-gleich', () => {
    const parsed = parseMarkdownBody(body, ids())
    const base = createBaseline(parsed, parsed.blocks)
    expect(raw + serializeBody(parsed.blocks, base)).toBe(text)
  })

  it('ist semantisch stabil bei kompletter Neuserialisierung', () => {
    const blocks = parseMarkdownBody(body, ids()).blocks
    const fresh = blocksToMarkdown(blocks)
    const again = parseMarkdownBody(fresh, ids()).blocks
    expect(strip(again)).toEqual(strip(blocks))
    expect(blocksToMarkdown(again)).toBe(fresh)
  })

  it('ändert beim Bearbeiten eines Blocks nur diesen Block', () => {
    const parsed = parseMarkdownBody(body, ids())
    const base = createBaseline(parsed, parsed.blocks)
    if (parsed.blocks.length < 2) return
    const blocks = structuredClone(parsed.blocks)
    const last = blocks[blocks.length - 1]!
    blocks[blocks.length - 1] = {
      id: 'neu',
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: 'Geändert', styles: {} }],
      children: []
    }
    const out = serializeBody(blocks, base)
    const firstEnd = parsed.origins[parsed.origins.length - 2]!.end
    expect(out.startsWith(body.slice(0, firstEnd))).toBe(true)
    expect(out).toContain('Geändert')
    expect(last).toBeDefined()
  })
})
