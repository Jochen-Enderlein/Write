import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { IndexDb, SNIPPET_OPEN, toFtsQuery } from '../../src/indexer/db'
import { extractPage } from '../../src/indexer/extract'

function db(): IndexDb {
  return new IndexDb(path.join(mkdtempSync(path.join(tmpdir(), 'write-idx-')), 'index.sqlite'))
}
const stamp = { mtimeMs: 1, size: 1 }

describe('Index', () => {
  it('extrahiert Titel, Tags und Links', () => {
    const p = extractPage(
      'Ordner/Seite.md',
      '---\ntitle: Schöne Seite\ntags: [Projekt]\n---\nText mit [[Ziel]] und [[Andere|Alias]] #wichtig\n\n```\n[[KeinLink]] #keintag\n```\n'
    )
    expect(p.title).toBe('Schöne Seite')
    expect(p.tags.sort()).toEqual(['projekt', 'wichtig'])
    expect(p.links.sort()).toEqual(['andere', 'ziel'])
  })

  it('findet Volltext mit Umlauten und Präfixen und markiert Treffer', () => {
    const d = db()
    d.upsert('a.md', stamp, extractPage('a.md', '# Größenordnung\n\nDie Übersicht über Äpfel.'))
    d.upsert('b.md', stamp, extractPage('b.md', 'Birnen'))
    const hits = d.search('uebersicht', null)
    expect(hits).toHaveLength(0)
    const hits2 = d.search('übers', null)
    expect(hits2.map((h) => h.path)).toEqual(['a.md'])
    expect(hits2[0]!.snippet).toContain(SNIPPET_OPEN)
    expect(d.search('apfel', null)).toHaveLength(1) // diacritics are ignored on purpose
    expect(d.search('Äpf', null)).toHaveLength(1)
  })

  it('löst Backlinks über Titel und Dateinamen auf und filtert nach Tags', () => {
    const d = db()
    d.upsert('Ziel.md', stamp, extractPage('Ziel.md', '---\ntitle: Das Ziel\n---\n#projekt'))
    d.upsert('A.md', stamp, extractPage('A.md', 'Link auf [[Das Ziel]]'))
    d.upsert('B.md', stamp, extractPage('B.md', 'Link auf [[ziel]] #projekt'))
    expect(
      d
        .backlinks('Ziel.md')
        .map((h) => h.path)
        .sort()
    ).toEqual(['A.md', 'B.md'])
    expect(d.resolve('das ziel')).toBe('Ziel.md')
    expect(d.resolve('Ziel')).toBe('Ziel.md')
    expect(
      d
        .search('', 'projekt')
        .map((h) => h.path)
        .sort()
    ).toEqual(['B.md', 'Ziel.md'])
    expect(d.tags()).toEqual([{ tag: 'projekt', count: 2 }])
    d.remove('A.md')
    expect(d.backlinks('Ziel.md').map((h) => h.path)).toEqual(['B.md'])
  })

  it('macht aus beliebiger Eingabe eine sichere FTS-Abfrage', () => {
    expect(toFtsQuery('a "b" OR c*')).toBe('"a"* "b"* "OR"* "c*"*')
    expect(() => db().search('NEAR( " AND', null)).not.toThrow()
  })

  it('liefert den Graphen mit aufgelösten Links, Tags und fehlenden Zielen', () => {
    const d = db()
    d.upsert('A.md', stamp, extractPage('A.md', '[[Ziel]] [[ziel]] [[Ordner/B]] [[Neu]] #projekt'))
    d.upsert(
      'Ordner/B.md',
      stamp,
      extractPage('Ordner/B.md', '---\ntitle: Bee\n---\n[[A]] [[Bee]]')
    )
    d.upsert('Ziel.md', stamp, extractPage('Ziel.md', 'Nichts #projekt #x'))
    const g = d.graph()
    const name = (i: number): string => g.pages[i]!.path
    expect(g.links.map(([a, b]) => `${name(a)}>${name(b)}`).sort()).toEqual([
      'A.md>Ordner/B.md',
      'A.md>Ziel.md',
      'Ordner/B.md>A.md'
    ])
    expect(g.pages.find((p) => p.path === 'Ziel.md')!.tags).toEqual(['projekt', 'x'])
    expect(g.ghosts).toEqual([
      { title: 'neu', from: [g.pages.findIndex((p) => p.path === 'A.md')] }
    ])
  })
})
