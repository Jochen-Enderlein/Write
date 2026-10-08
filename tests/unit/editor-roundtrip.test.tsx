// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BlockNoteEditor } from '@blocknote/core'
import { splitFrontmatter } from '@shared/frontmatter'
import { type Block, createBaseline, parseMarkdownBody, serializeBody } from '@shared/markdown'
import { prepareBlocks, schema } from '@renderer/editor/schema'

const dir = join(__dirname, '../fixtures/roundtrip')
const fixtures = readdirSync(dir).filter((f) => f.endsWith('.md'))

function load(body: string) {
  let n = 0
  const raw = parseMarkdownBody(body, () => `b${++n}`)
  const parsed = { ...raw, blocks: prepareBlocks(raw.blocks) }
  const editor = BlockNoteEditor.create({
    schema,
    initialContent: parsed.blocks.length ? (parsed.blocks as never) : undefined
  })
  return { parsed, editor, doc: () => editor.document as unknown as Block[] }
}

describe.each(fixtures)('BlockNote-Roundtrip %s', (name) => {
  const text = readFileSync(join(dir, name), 'utf8')
  const { raw, body } = splitFrontmatter(text)

  it('ist nach Laden in den Editor und Speichern byte-gleich', () => {
    const { parsed, doc } = load(body)
    const base = createBaseline(parsed, doc())
    expect(raw + serializeBody(doc(), base)).toBe(text)
  })

  it('erzeugt aus dem Editor-Dokument stabiles Markdown', () => {
    const { doc } = load(body)
    const fresh = serializeBody(doc(), null)
    const second = load(fresh)
    expect(serializeBody(second.doc(), null)).toBe(fresh)
  })

  it('schreibt nach einer Änderung nur den geänderten Block neu', () => {
    const { parsed, editor, doc } = load(body)
    const base = createBaseline(parsed, doc())
    const first = editor.document[0]
    if (!first || parsed.origins.length < 2) return
    editor.insertBlocks([{ type: 'paragraph', content: 'Neuer Absatz' }] as never, first, 'before')
    const out = serializeBody(doc(), base)
    expect(out).toContain('Neuer Absatz')
    const o = parsed.origins
    // Everything from the first original block onward is untouched
    expect(out.endsWith(body.slice(o[0]!.start))).toBe(true)
  })
})

describe('Datenbank-Block', () => {
  it('wird aus ```write-table zum Tabellenblock und zurück', () => {
    const body = '```write-table\nfrom: Projekte\nsort: [status]\n```\n'
    const { doc } = load(body)
    const block = doc()[0]!
    expect(block.type).toBe('dbTable')
    expect(block.props.source).toBe('from: Projekte\nsort: [status]')
    expect(serializeBody(doc(), null)).toBe(body)
  })
})
