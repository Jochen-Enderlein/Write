import { describe, expect, it } from 'vitest'
import type { GraphData } from '@shared/types'
import {
  buildGraph,
  communities,
  globalLayout,
  localLayout,
  positions,
  rings
} from '@renderer/graph/layout'

const page = (path: string, tags: string[] = []): GraphData['pages'][number] => ({
  path,
  title: path.replace(/\.md$/, '').split('/').pop()!,
  icon: null,
  tags
})

/** Two tight clusters joined by one link, a tag, a missing page and a lonely page. */
const data: GraphData = {
  pages: [
    page('A/Sonne.md', ['projekt']),
    page('A/Eins.md'),
    page('A/Zwei.md'),
    page('B/Hub.md', ['projekt']),
    page('B/Drei.md'),
    page('B/Vier.md'),
    page('Allein.md')
  ],
  links: [
    [1, 0],
    [2, 0],
    [1, 2],
    [4, 3],
    [5, 3],
    [4, 5],
    [0, 3]
  ],
  ghosts: [{ title: 'fehlt', from: [1] }]
}

describe('Graph-Layout', () => {
  it('baut Knoten für Seiten, Tags und fehlende Seiten nur auf Wunsch', () => {
    expect(buildGraph(data, { tags: false, ghosts: false }).nodes).toHaveLength(7)
    const g = buildGraph(data, { tags: true, ghosts: true })
    expect(g.nodes.map((n) => n.id)).toContain('#projekt')
    expect(g.nodes.map((n) => n.id)).toContain('?fehlt')
    expect(g.nodes[g.byId.get('#projekt')!]!.degree).toBe(2)
    expect(g.nodes[0]!.group).toBe('A')
  })

  it('findet die beiden Gruppen', () => {
    const g = buildGraph(data, { tags: false, ghosts: false })
    const label = communities(g)
    expect(label[1]).toBe(label[0])
    expect(label[2]).toBe(label[0])
    expect(label[4]).toBe(label[3])
    expect(label[3]).not.toBe(label[0])
  })

  it('setzt im lokalen Graphen die Seite in die Mitte und ihre Links auf Umlaufbahnen', () => {
    const g = buildGraph(data, { tags: true, ghosts: false })
    const l = localLayout(g, 0, 2)
    expect(l.bodies[0]).toMatchObject({ node: 0, role: 'sun', parent: -1 })
    const planets = l.bodies.filter((b) => b.role === 'planet').map((b) => g.nodes[b.node]!.id)
    expect(planets.sort()).toEqual(['#projekt', 'A/Eins.md', 'A/Zwei.md', 'B/Hub.md'])
    const moons = l.bodies.filter((b) => b.role === 'moon').map((b) => g.nodes[b.node]!.id)
    expect(moons.sort()).toEqual(['B/Drei.md', 'B/Vier.md'])
    expect(l.bodyOf[g.byId.get('Allein.md')!]).toBe(-1)
    expect(localLayout(g, 0, 1).bodies.some((b) => b.role === 'moon')).toBe(false)
  })

  it('zeigt im globalen Graphen jede Seite genau einmal, Einzelgänger im Asteroidengürtel', () => {
    const g = buildGraph(data, { tags: true, ghosts: true })
    const l = globalLayout(g)
    const shown = l.bodies.filter((b) => b.node >= 0).map((b) => b.node)
    expect(new Set(shown).size).toBe(g.nodes.length)
    expect(shown).toHaveLength(g.nodes.length)
    expect(l.bodies[l.bodyOf[g.byId.get('Allein.md')!]!]!.role).toBe('asteroid')
    expect(l.bodies.filter((b) => b.role === 'sun' && b.node >= 0).length).toBe(2)
  })

  it('ist bei jedem Aufruf gleich', () => {
    const g = buildGraph(data, { tags: true, ghosts: true })
    expect(globalLayout(g)).toEqual(globalLayout(g))
  })

  it('lässt auf einem Ring genug Abstand', () => {
    const r = rings(50, 5, 3, 2)
    for (let i = 1; i < r.length; i++) {
      const [ra, aa] = r[i - 1]!
      const [rb, ab] = r[i]!
      if (ra === rb) expect(ra * (ab - aa)).toBeGreaterThanOrEqual(2 - 1e-9)
    }
  })

  it('rechnet Positionen relativ zum umkreisten Körper', () => {
    const g = buildGraph(data, { tags: false, ghosts: false })
    const l = localLayout(g, 0, 2)
    const out = new Float32Array(l.bodies.length * 3)
    positions(l.bodies, 3.5, out)
    l.bodies.forEach((b, i) => {
      if (b.parent < 0) return
      const d = Math.hypot(
        out[i * 3]! - out[b.parent * 3]!,
        out[i * 3 + 1]! - out[b.parent * 3 + 1]!,
        out[i * 3 + 2]! - out[b.parent * 3 + 2]!
      )
      expect(d).toBeCloseTo(b.orbit, 3)
    })
  })

  it('legt 5000 Seiten schnell aus', () => {
    const n = 5000
    const big: GraphData = { pages: [], links: [], ghosts: [] }
    for (let i = 0; i < n; i++)
      big.pages.push(page(`F${i % 20}/P${i}.md`, i % 7 ? [] : [`t${i % 30}`]))
    for (let i = 0; i < n * 3; i++) {
      const a = (i * 7919) % n
      const b = (a + 1 + ((i * 104729) % 40)) % n
      big.links.push([a, b])
    }
    const start = performance.now()
    const g = buildGraph(big, { tags: true, ghosts: false })
    globalLayout(g)
    localLayout(g, 0, 3)
    expect(performance.now() - start).toBeLessThan(1500)
  })
})
