import { describe, expect, it } from 'vitest'
import { record, redo, startHistory, undo } from '@renderer/editor/diagram/history'

describe('Rückgängig im Diagramm-Editor', () => {
  it('nimmt Bauschritte einzeln zurück und stellt sie wieder her', () => {
    let h = startHistory('a')
    h = record(h, 'ab', false, 0)
    h = record(h, 'abc', false, 10)
    h = undo(h)
    expect(h.present).toBe('ab')
    h = undo(h)
    expect(h.present).toBe('a')
    expect(undo(h)).toBe(h)
    h = redo(redo(h))
    expect(h.present).toBe('abc')
  })

  it('fasst schnelles Tippen zu einem Schritt zusammen', () => {
    let h = startHistory('')
    h = record(h, 'H', true, 0)
    h = record(h, 'Ha', true, 300)
    h = record(h, 'Hal', true, 600)
    expect(undo(h).present).toBe('')
  })

  it('beginnt nach einer Pause oder einem Bauschritt einen neuen Schritt', () => {
    let h = startHistory('')
    h = record(h, 'H', true, 0)
    h = record(h, 'Ha', true, 2000)
    expect(undo(h).present).toBe('H')
    h = record(h, 'Ha!', false, 2100)
    h = record(h, 'Ha!x', true, 2200)
    expect(undo(h).present).toBe('Ha!')
  })

  it('verwirft das Wiederherstellen, sobald etwas Neues passiert', () => {
    let h = record(startHistory('a'), 'ab', false, 0)
    h = record(undo(h), 'ax', false, 10)
    expect(redo(h)).toBe(h)
  })
})
