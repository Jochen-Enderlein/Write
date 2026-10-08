import { describe, expect, it } from 'vitest'
import {
  applyTable,
  columnType,
  compareValues,
  inferType,
  matchesFilter,
  parseInput,
  propertiesOf,
  sanitizeConfig,
  type Row
} from '@shared/properties'

const row = (title: string, props: Row['props']): Row => ({ path: title + '.md', title, props })

describe('Eigenschaften', () => {
  it('lässt die Felder der App weg', () => {
    expect(
      propertiesOf({
        id: 'x',
        title: 'T',
        icon: '🚀',
        tags: ['a'],
        created: 'c',
        updated: 'u',
        status: 'offen'
      })
    ).toEqual({ status: 'offen' })
  })

  it('erkennt Typen aus den Werten', () => {
    expect(inferType(true)).toBe('checkbox')
    expect(inferType(3)).toBe('number')
    expect(inferType('2026-10-20')).toBe('date')
    expect(inferType('2026-10-20T09:30')).toBe('date')
    expect(inferType('[[Kunde A]]')).toBe('link')
    expect(inferType(['a', 'b'])).toBe('list')
    expect(inferType('offen')).toBe('text')
    expect(inferType('')).toBeNull()
    expect(columnType(['2026-01-01', null, '2026-02-01', 'bald'])).toBe('date')
    expect(columnType([null])).toBe('text')
  })

  it('sortiert Zahlen, Daten und Umlaute; Leeres immer zuletzt', () => {
    expect(compareValues(2, 10)).toBeLessThan(0)
    expect(compareValues('Ärger', 'Zebra')).toBeLessThan(0)
    expect(compareValues(null, 'a')).toBeGreaterThan(0)
    const rows = [row('C', { due: '2026-03-01' }), row('A', {}), row('B', { due: '2026-01-01' })]
    expect(applyTable(rows, { sort: [{ key: 'due', dir: 'asc' }] }).map((r) => r.title)).toEqual([
      'B',
      'C',
      'A'
    ])
    expect(applyTable(rows, { sort: [{ key: 'due', dir: 'desc' }] }).map((r) => r.title)).toEqual([
      'C',
      'B',
      'A'
    ])
    expect(applyTable(rows, {}).map((r) => r.title)).toEqual(['A', 'B', 'C'])
  })

  it('filtert ohne Groß-/Kleinschreibung, Listen nach Eintrag', () => {
    expect(matchesFilter('Offen', { key: 's', op: 'is', value: 'offen' })).toBe(true)
    expect(matchesFilter(['rot', 'blau'], { key: 's', op: 'is', value: 'Blau' })).toBe(true)
    expect(matchesFilter(['rot'], { key: 's', op: 'isNot', value: 'blau' })).toBe(true)
    expect(matchesFilter(undefined, { key: 's', op: 'empty' })).toBe(true)
    expect(matchesFilter('2026-01-05', { key: 'd', op: 'before', value: '2026-02-01' })).toBe(true)
    expect(matchesFilter(5, { key: 'n', op: 'after', value: '10' })).toBe(false)
    expect(matchesFilter(null, { key: 'd', op: 'before', value: '2026-02-01' })).toBe(false)
    const rows = [row('A', { s: 'erledigt' }), row('B', { s: 'offen' }), row('C', {})]
    expect(
      applyTable(rows, { filter: [{ key: 's', op: 'isNot', value: 'erledigt' }] }).map(
        (r) => r.title
      )
    ).toEqual(['B', 'C'])
  })

  it('liest Eingaben passend zum Spaltentyp', () => {
    expect(parseInput('3,5', 'number')).toBe(3.5)
    expect(parseInput('ja', 'text')).toBe('ja')
    expect(parseInput('a, b,', 'list')).toEqual(['a', 'b'])
    expect(parseInput('Kunde', 'link')).toBe('[[Kunde]]')
    expect(parseInput('  ', 'text')).toBeNull()
  })

  it('nimmt aus der Block-Konfiguration nur Gültiges', () => {
    expect(
      sanitizeConfig({
        from: '/Projekte/',
        columns: ['status', 3],
        sort: ['due', { key: 'prio', dir: 'desc' }, 7],
        filter: [
          { key: 's', op: 'is', value: 1 },
          { key: 's', op: 'kaputt' }
        ]
      })
    ).toEqual({
      from: 'Projekte',
      columns: ['status'],
      sort: [
        { key: 'due', dir: 'asc' },
        { key: 'prio', dir: 'desc' }
      ],
      filter: [{ key: 's', op: 'is', value: '1' }]
    })
    expect(sanitizeConfig('kaputt')).toEqual({})
  })
})
