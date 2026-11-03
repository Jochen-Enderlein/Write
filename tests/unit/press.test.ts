import { describe, expect, it } from 'vitest'
import { missedRelease } from '@renderer/lib/press'

describe('Loslassen nach dem Drücken', () => {
  it('erkennt ein Loslassen auf einer verrutschten Zeile als verpassten Klick', () => {
    expect(missedRelease({ x: 40, y: 100 }, { x: 40, y: 100 }, false)).toBe(true)
    expect(missedRelease({ x: 40, y: 100 }, { x: 42, y: 103 }, false)).toBe(true)
  })

  it('lässt einen normalen Klick auf derselben Zeile dem Baum', () => {
    expect(missedRelease({ x: 40, y: 100 }, { x: 40, y: 100 }, true)).toBe(false)
  })

  it('öffnet nichts, wenn der Zeiger weggezogen wurde', () => {
    expect(missedRelease({ x: 40, y: 100 }, { x: 40, y: 130 }, false)).toBe(false)
    expect(missedRelease({ x: 40, y: 100 }, { x: 45, y: 100 }, false)).toBe(false)
  })
})
