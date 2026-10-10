import { describe, expect, it } from 'vitest'
import { smartReplacement, wrapPair, type QuoteStyle } from '@renderer/editor/typing'

/** Types `chars` one by one after `start`, the way the editor applies replacements. */
function type(start: string, chars: string, style: QuoteStyle = 'de'): string {
  let text = start
  for (const c of chars) {
    const rep = smartReplacement(text.slice(-3), c, style)
    text = rep ? text.slice(0, text.length - rep.back) + rep.insert : text + c
  }
  return text
}

describe('Typografische Zeichen', () => {
  it('setzt deutsche Anführungszeichen', () => {
    expect(type('', 'Er sagt "Hallo".')).toBe('Er sagt „Hallo“.')
    expect(type('', '("Ja")')).toBe('(„Ja“)')
  })

  it('setzt englische Anführungszeichen', () => {
    expect(type('', 'She said "hi".', 'en')).toBe('She said “hi”.')
  })

  it('macht aus dem Hochkomma nach einem Buchstaben einen Apostroph', () => {
    expect(type('', "geht's")).toBe('geht’s')
    expect(type('', "it's 'fine'", 'en')).toBe('it’s ‘fine’')
  })

  it('macht aus -- zwischen Leerzeichen einen Gedankenstrich', () => {
    expect(type('', 'A -- B')).toBe('A – B')
    expect(type('', '-- B')).toBe('– B')
  })

  it('lässt ---, --flag und <!-- in Ruhe', () => {
    expect(type('', '--- ')).toBe('--- ')
    expect(type('', 'run --flag x')).toBe('run --flag x')
    expect(type('', 'a<!-- b')).toBe('a<!-- b')
  })

  it('macht aus drei Punkten eine Ellipse, aber nur einmal', () => {
    expect(type('', 'Und dann...')).toBe('Und dann…')
    expect(type('', '....')).toBe('….')
  })
})

describe('Markierung umschließen', () => {
  it('umschließt mit Klammern und Anführungszeichen', () => {
    expect(wrapPair('(', true, 'de')).toEqual(['(', ')'])
    expect(wrapPair('[', true, 'de')).toEqual(['[', ']'])
    expect(wrapPair('"', true, 'de')).toEqual(['„', '“'])
    expect(wrapPair('"', true, 'en')).toEqual(['“', '”'])
    expect(wrapPair('"', false, 'de')).toEqual(['"', '"'])
  })

  it('ersetzt bei anderen Zeichen wie gewohnt', () => {
    expect(wrapPair('a', true, 'de')).toBeNull()
    expect(wrapPair('*', true, 'de')).toBeNull()
  })
})
