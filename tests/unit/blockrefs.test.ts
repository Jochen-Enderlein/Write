import { describe, expect, it } from 'vitest'
import {
  blockIdOf,
  blockLine,
  blockSection,
  matchBlockRef,
  newBlockId,
  stripBlockId
} from '@shared/blockrefs'
import { extractWikilinks, rewriteWikilinks } from '@shared/wikilinks'

const BODY = [
  '# Projekt',
  '',
  'Erster Absatz,',
  'zweite Zeile. ^absatz',
  '',
  '- Punkt eins ^p1',
  '  - darunter',
  '- Punkt zwei',
  '',
  '> Ein Zitat',
  '> über zwei Zeilen',
  '',
  '^zitat',
  '',
  '```js',
  'const a = 1',
  '',
  'const b = "^nichtImCode"',
  '```',
  '',
  '^code',
  '',
  '## Ziele ^ziele'
].join('\n')

describe('Blockreferenzen', () => {
  it('erkennt ^id am Zeilenende', () => {
    expect(blockIdOf('Text ^abc-1')).toBe('abc-1')
    expect(blockIdOf('^abc')).toBe('abc')
    expect(blockIdOf('Text^abc')).toBeNull()
    expect(blockIdOf('2^10 ist viel')).toBeNull()
    expect(stripBlockId('Text ^abc')).toBe('Text')
    expect(newBlockId()).toMatch(/^[a-z0-9]{6}$/)
  })

  it('findet Absatz, Listenpunkt mit Kindern und Überschrift', () => {
    expect(blockSection(BODY, 'absatz')).toBe('Erster Absatz,\nzweite Zeile.')
    expect(blockSection(BODY, 'p1')).toBe('- Punkt eins\n  - darunter')
    expect(blockSection(BODY, 'ziele')).toBe('## Ziele')
  })

  it('nimmt bei ^id auf eigener Zeile den Block darüber, auch Code mit Leerzeilen', () => {
    expect(blockSection(BODY, 'zitat')).toBe('> Ein Zitat\n> über zwei Zeilen')
    expect(blockSection(BODY, 'code')).toBe('```js\nconst a = 1\n\nconst b = "^nichtImCode"\n```')
  })

  it('ignoriert Ids in Code und unbekannte Ids', () => {
    expect(blockLine(BODY, 'nichtImCode')).toBe(-1)
    expect(blockSection(BODY, 'fehlt')).toBeNull()
    expect(blockLine(BODY, 'ABSATZ')).toBe(3)
  })

  it('findet den Editor-Block zur Id', () => {
    const blocks = [
      { id: 'a', text: 'Absatz ^x1' },
      { id: 'b', text: 'Tabelle' },
      { id: 'c', text: '^tab' }
    ]
    expect(matchBlockRef(blocks, 'x1')).toBe('a')
    expect(matchBlockRef(blocks, 'tab')).toBe('b')
    expect(matchBlockRef(blocks, 'nix')).toBeNull()
  })

  it('verlinkt die Seite und behält #^id beim Umbenennen', () => {
    expect(extractWikilinks('[[Projekt#^ziele]] ![[Projekt#^p1]]')).toEqual(['Projekt', 'Projekt'])
    expect(rewriteWikilinks('[[Alt#^p1|hier]]', 'Alt', 'Neu')).toBe('[[Neu#^p1|hier]]')
  })
})
