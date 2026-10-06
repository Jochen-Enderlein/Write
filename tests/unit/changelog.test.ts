import { describe, expect, it } from 'vitest'
import { compareVersions, entriesSince, parseChangelog } from '@shared/changelog'

const md = `# Changelog

## Unveröffentlicht

- noch nicht fertig

## [0.3.0] – 2026-11-01

### Neu
- Drei

## 0.2.0

- Zwei

## 0.1.0 - 2026-10-06

- Eins
`

describe('Changelog', () => {
  it('liest Versionen, Datum und Text und ignoriert Unveröffentlichtes', () => {
    const e = parseChangelog(md)
    expect(e.map((x) => x.version)).toEqual(['0.3.0', '0.2.0', '0.1.0'])
    expect(e[0]).toEqual({ version: '0.3.0', date: '2026-11-01', body: '### Neu\n- Drei' })
    expect(e[1]!.date).toBeNull()
  })

  it('vergleicht Versionen numerisch', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBe(1)
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1)
    expect(compareVersions('0.2.0', '0.2.0')).toBe(0)
  })

  it('zeigt nach einem Update alle übersprungenen Versionen', () => {
    const e = parseChangelog(md)
    expect(entriesSince(e, '0.1.0', '0.3.0').map((x) => x.version)).toEqual(['0.3.0', '0.2.0'])
    expect(entriesSince(e, '0.2.0', '0.2.0')).toEqual([])
    expect(entriesSince(e, null, '0.2.0').map((x) => x.version)).toEqual(['0.2.0', '0.1.0'])
  })
})
