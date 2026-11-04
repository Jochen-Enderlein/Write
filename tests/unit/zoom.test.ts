import { describe, expect, it } from 'vitest'
import { MAX_SCALE, MIN_SCALE, fitView, zoomAt } from '@renderer/lib/zoom'

describe('Diagramm einpassen', () => {
  it('zeigt ein breites Diagramm so groß, wie es in die Breite passt, und mittig', () => {
    const v = fitView({ width: 1000, height: 200 }, { width: 1064, height: 800 })
    expect(v.scale).toBe(1)
    expect(v.x).toBe(32)
    expect(v.y).toBe(300)
  })

  it('vergrößert ein kleines Diagramm, aber höchstens auf das Dreifache', () => {
    expect(fitView({ width: 100, height: 50 }, { width: 2000, height: 1200 }).scale).toBe(3)
  })

  it('hält sich an eine engere Obergrenze, wenn sie vorgegeben ist', () => {
    expect(fitView({ width: 100, height: 50 }, { width: 2000, height: 1200 }, 48, 1.5).scale).toBe(
      1.5
    )
  })

  it('verkleinert ein Diagramm, das größer als das Fenster ist', () => {
    expect(fitView({ width: 4000, height: 400 }, { width: 2064, height: 900 }).scale).toBe(0.5)
  })

  it('kommt mit einem leeren Diagramm zurecht', () => {
    expect(fitView({ width: 0, height: 0 }, { width: 800, height: 600 })).toEqual({
      scale: 1,
      x: 0,
      y: 0
    })
  })
})

describe('Zoomen', () => {
  it('lässt die Stelle unter dem Zeiger, wo sie ist', () => {
    const before = { scale: 1, x: 100, y: 50 }
    const point = { x: 300, y: 250 }
    const after = zoomAt(before, 2, point)
    expect(after.scale).toBe(2)
    // The content point under the pointer: (300 - 100) / 1 = 200 → 200 × 2 + x = 300
    expect(200 * after.scale + after.x).toBe(point.x)
    expect(200 * after.scale + after.y).toBe(point.y)
  })

  it('zoomt nicht über die Grenzen hinaus', () => {
    expect(zoomAt({ scale: 6, x: 0, y: 0 }, 4, { x: 0, y: 0 }).scale).toBe(MAX_SCALE)
    expect(zoomAt({ scale: 0.2, x: 0, y: 0 }, 0.1, { x: 0, y: 0 }).scale).toBe(MIN_SCALE)
  })
})
