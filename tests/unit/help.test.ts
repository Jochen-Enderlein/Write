import { describe, expect, it } from 'vitest'
import { COMMANDS, acceleratorGlyphs } from '@shared/keymap'
import { markdownToBlocks } from '@shared/markdown'
import { de } from '../../src/renderer/src/help/content.de'
import { en } from '../../src/renderer/src/help/content.en'
import { HELP_TOPICS, isHelpTopic, type HelpContent } from '../../src/renderer/src/help/model'

const commands = new Set<string>(COMMANDS.map((c) => c.id))

/** Every inline text of a language, with where it came from. */
function texts(content: HelpContent): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = []
  for (const id of HELP_TOPICS) {
    const t = content.topics[id]
    out.push({ where: `${id}.summary`, text: t.summary })
    t.blocks.forEach((b, i) => {
      if ('text' in b) out.push({ where: `${id}[${i}]`, text: b.text })
      if ('items' in b && b.kind !== 'keys')
        b.items.forEach((s, j) => out.push({ where: `${id}[${i}][${j}]`, text: s }))
    })
  }
  return out
}

describe.each([
  ['de', de],
  ['en', en]
] as const)('Hilfe (%s)', (_lng, content) => {
  it('nennt nur Befehle, die es gibt', () => {
    for (const { where, text } of texts(content))
      for (const m of text.matchAll(/\{\{cmd:([^}]+)\}\}/g))
        expect(commands.has(m[1]!), `${where}: ${m[1]}`).toBe(true)
    for (const id of HELP_TOPICS)
      for (const b of content.topics[id].blocks) {
        if (b.kind === 'try') expect(commands.has(b.command), id).toBe(true)
        if (b.kind === 'keys')
          for (const k of b.items)
            if ('command' in k) expect(commands.has(k.command), id).toBe(true)
      }
  })

  it('verlinkt nur Themen, die es gibt', () => {
    for (const { where, text } of texts(content))
      for (const m of text.matchAll(/\]\(topic:([\w-]+)\)/g))
        expect(isHelpTopic(m[1]), `${where}: ${m[1]}`).toBe(true)
    for (const id of HELP_TOPICS)
      for (const r of content.topics[id].related ?? []) expect(isHelpTopic(r), id).toBe(true)
  })

  it('zeigt jedes Beispiel im Editor, ohne Rohtext-Blöcke', () => {
    for (const id of HELP_TOPICS)
      for (const b of content.topics[id].blocks) {
        if (b.kind !== 'example') continue
        const blocks = markdownToBlocks(b.markdown, () => 'x')
        expect(blocks.length, id).toBeGreaterThan(0)
        expect(
          blocks.filter((x) => x.type === 'rawMarkdown').map((x) => x.props),
          id
        ).toEqual([])
      }
  })

  it('löst die Seiten der Beispiele auf', () => {
    const titles = Object.keys(content.examplePages).map((t) => t.toLowerCase())
    for (const id of HELP_TOPICS)
      for (const b of content.topics[id].blocks) {
        if (b.kind !== 'example') continue
        for (const m of b.markdown.matchAll(/!\[\[([^\]|#]+)/g))
          expect(titles, `${id}: ${m[1]}`).toContain(m[1]!.trim().toLowerCase())
      }
  })
})

describe('Hilfe zweisprachig', () => {
  it('hat in beiden Sprachen dieselben Themen mit demselben Aufbau', () => {
    for (const id of HELP_TOPICS) {
      const kinds = (c: HelpContent): string[] => c.topics[id].blocks.map((b) => b.kind)
      expect(kinds(en), id).toEqual(kinds(de))
      expect(en.topics[id].related, id).toEqual(de.topics[id].related)
    }
  })

  it('schreibt ⌘? für die Hilfe', () => {
    expect(acceleratorGlyphs('CmdOrCtrl+Shift+/')).toBe('⌘?')
  })
})
