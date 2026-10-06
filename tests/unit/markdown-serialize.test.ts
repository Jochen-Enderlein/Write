import { describe, expect, it } from 'vitest'
import { type Block, blocksToMarkdown, fingerprint, parseMarkdownBody } from '@shared/markdown'

const p = (text: string): Block => ({
  type: 'paragraph',
  props: {},
  content: [{ type: 'text', text, styles: {} }],
  children: []
})
let n = 0
const ids = (): string => `x${n++}`
const reparse = (md: string): string[] => parseMarkdownBody(md, ids).blocks.map(fingerprint)

describe('Serialisierung', () => {
  it('lässt getippte Wiki-Links und Tags unescaped', () => {
    const md = blocksToMarkdown([p('#tag am Anfang'), p('Text [[Link]] und [[A|b]] #zwei')])
    expect(md).toBe('#tag am Anfang\n\nText [[Link]] und [[A|b]] #zwei\n')
  })

  it('escaped Zeilen, die wie Blöcke aussehen', () => {
    const blocks = [p('a\n- b\n# c\n1. d\n> e')]
    const md = blocksToMarkdown(blocks)
    const again = parseMarkdownBody(md, ids).blocks
    expect(again).toHaveLength(1)
    expect(again[0]!.type).toBe('paragraph')
  })

  it('verschachtelt Formatierungen ohne Mehrdeutigkeit', () => {
    const blocks: Block[] = [
      {
        type: 'paragraph',
        props: {},
        children: [],
        content: [
          { type: 'text', text: 'fett ', styles: { bold: true } },
          { type: 'text', text: 'fett-kursiv', styles: { bold: true, italic: true } },
          { type: 'text', text: ' normal ', styles: {} },
          { type: 'text', text: 'code', styles: { code: true, bold: true } }
        ]
      }
    ]
    const md = blocksToMarkdown(blocks)
    expect(reparse(md)).toEqual(reparse(blocksToMarkdown(parseMarkdownBody(md, ids).blocks)))
    expect(md).toContain('**fett *fett-kursiv***')
  })

  it('schreibt Callouts im Obsidian-Format', () => {
    const md = blocksToMarkdown([
      {
        type: 'callout',
        props: { kind: 'warning', title: 'Achtung', fold: '' },
        content: [{ type: 'text', text: 'Inhalt', styles: {} }],
        children: []
      }
    ])
    expect(md).toBe('> [!warning] Achtung\n> Inhalt\n')
  })

  it('beendet nummerierte Listen mit eigenem Start durch anderes Trennzeichen', () => {
    const item = (text: string, start?: number): Block => ({
      type: 'numberedListItem',
      props: start ? { start } : {},
      content: [{ type: 'text', text, styles: {} }],
      children: []
    })
    const md = blocksToMarkdown([item('a'), item('b'), item('c', 7), item('d')])
    expect(md).toBe('1. a\n2. b\n7) c\n8) d\n')
  })
})

describe('Textmarker (==…==)', () => {
  const inline = (md: string) => {
    const b = parseMarkdownBody(md, ids).blocks[0]!
    return b.content as { type: string; text?: string; styles?: Record<string, true> }[]
  }
  const marked = (md: string): string[] =>
    inline(md)
      .filter((n) => n.type === 'text' && n.styles?.highlight)
      .map((n) => n.text!)

  it('erkennt Markierungen, auch über Formatierungen hinweg', () => {
    expect(marked('Ein ==markierter== Text')).toEqual(['markierter'])
    expect(marked('==a **b** c==')).toEqual(['a ', 'b', ' c'])
    expect(marked('==x==')).toEqual(['x'])
  })

  it('lässt Vergleiche, Code und Escapes unangetastet', () => {
    expect(marked('x == y und a ==b')).toEqual([])
    expect(marked('`==code==`')).toEqual([])
    expect(marked('\\==kein== Marker')).toEqual([])
    expect(inline('\\==kein== Marker')[0]!.text).toBe('==kein== Marker')
  })

  it('schreibt Markierungen als ==…== und escaped getippte Marker', () => {
    const md = blocksToMarkdown([
      {
        type: 'paragraph',
        props: {},
        children: [],
        content: [
          { type: 'text', text: 'Das ', styles: {} },
          { type: 'text', text: 'ist', styles: { highlight: true } },
          { type: 'text', text: ' wichtig', styles: { highlight: true, bold: true } },
          { type: 'text', text: ', a==b bleibt, x == y auch', styles: {} }
        ]
      }
    ])
    expect(md).toBe('Das ==ist **wichtig**==, a\\==b bleibt, x == y auch\n')
    expect(reparse(md)).toEqual(reparse(blocksToMarkdown(parseMarkdownBody(md, ids).blocks)))
    expect(marked(md)).toEqual(['ist ', 'wichtig'])
  })
})
