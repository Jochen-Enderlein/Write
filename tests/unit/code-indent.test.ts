import { describe, expect, it } from 'vitest'
import { editForKey, newlineWithIndent } from '@renderer/editor/codeIndent'

/** Applies a key at the `|` markers (one for a cursor, two for a selection). */
function press(key: 'Enter' | 'Tab' | 'Shift-Tab', marked: string): string {
  const start = marked.indexOf('|')
  const second = marked.indexOf('|', start + 1)
  const end = second === -1 ? start : second - 1
  const text = marked.replaceAll('|', '')
  const edit = editForKey(key, text, start, end)!
  const out = edit.text
  return edit.start === edit.end
    ? out.slice(0, edit.start) + '|' + out.slice(edit.start)
    : out.slice(0, edit.start) + '|' + out.slice(edit.start, edit.end) + '|' + out.slice(edit.end)
}

describe('Einrückung in Code', () => {
  it('übernimmt beim Zeilenumbruch die Einrückung', () => {
    expect(newlineWithIndent('graph TD\n  A --> B')).toBe('\n  ')
    expect(press('Enter', 'graph TD\n  A --> B|')).toBe('graph TD\n  A --> B\n  |')
  })

  it('rückt nach einer öffnenden Klammer eine Ebene weiter ein', () => {
    expect(press('Enter', 'if (x) {|\n}')).toBe('if (x) {\n  |\n}')
    expect(press('Enter', 'def f():|')).toBe('def f():\n  |')
  })

  it('fügt mit Tab zwei Leerzeichen ein', () => {
    expect(press('Tab', 'A|B')).toBe('A  |B')
  })

  it('rückt markierte Zeilen ein und aus', () => {
    expect(press('Tab', '|a\nb|\nc')).toBe('  |a\n  b|\nc')
    expect(press('Shift-Tab', '  |a\n  b|\nc')).toBe('|a\nb|\nc')
  })

  it('rückt die Zeile mit dem Cursor aus', () => {
    expect(press('Shift-Tab', 'x\n    A --> |B')).toBe('x\n  A --> |B')
    expect(press('Shift-Tab', 'x\n |A')).toBe('x\n|A')
    expect(press('Shift-Tab', 'x\nA|')).toBe('x\nA|')
  })
})
