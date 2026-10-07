import { describe, expect, it } from 'vitest'
import { blocksToMarkdown, markdownToBlocks } from '@shared/markdown'

let n = 0
const parse = (md: string) => markdownToBlocks(md, () => `b${++n}`)

describe('Formeln und Fußnoten', () => {
  it('erkennt Formeln im Text, aber keine Preise', () => {
    const [p] = parse('Mit $E = mc^2$, aber $5 und $10 sowie $ x $ bleiben Text.')
    const kinds = (p!.content as { type: string; props?: { latex?: string }; text?: string }[]).map(
      (c) => (c.type === 'inlineMath' ? `math:${c.props!.latex}` : c.type)
    )
    expect(kinds).toEqual(['text', 'math:E = mc^2', 'text'])
  })

  it('macht aus $$-Blöcken eine Formel', () => {
    const [b] = parse('$$\n\\frac{1}{2}\n$$')
    expect(b).toMatchObject({ type: 'math', props: { source: '\\frac{1}{2}' } })
    expect(blocksToMarkdown([b!])).toBe('$$\n\\frac{1}{2}\n$$\n')
  })

  it('macht aus Fußnoten Verweis und Notiz, mehrteilige bleiben roh', () => {
    const blocks = parse('Text[^a].\n\n[^a]: Notiz mit **fett**.\n\n[^b]: Eins.\n\n    Zwei.')
    expect((blocks[0]!.content as { type: string }[]).map((c) => c.type)).toEqual([
      'text',
      'footnoteRef',
      'text'
    ])
    expect(blocks[1]).toMatchObject({ type: 'footnote', props: { label: 'a' } })
    expect(blocks[2]!.type).toBe('rawMarkdown')
    expect(blocksToMarkdown(blocks.slice(0, 2))).toBe('Text[^a].\n\n[^a]: Notiz mit **fett**.\n')
  })
})
