import type { GraphData } from '@shared/types'

/**
 * Solar-system layout for the graph view. Positions are computed, not simulated: the same vault
 * always looks the same, and thousands of pages are laid out in milliseconds.
 *
 * Every body orbits a parent on a circle; the renderer only advances `phase` over time.
 */

export type NodeKind = 'page' | 'tag' | 'ghost'

export interface GraphNode {
  /** Page path, `#tag` or `?title` for a link target without a page */
  id: string
  kind: NodeKind
  label: string
  icon: string | null
  /** Top-level folder ('' for the vault root); tags and ghosts have none */
  group: string
  degree: number
}

export interface GraphEdge {
  a: number
  b: number
  kind: 'link' | 'tag'
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** Neighbours per node, undirected */
  adj: number[][]
  byId: Map<string, number>
}

export interface GraphOptions {
  tags: boolean
  ghosts: boolean
}

export function buildGraph(data: GraphData, opts: GraphOptions): Graph {
  const nodes: GraphNode[] = data.pages.map((p) => ({
    id: p.path,
    kind: 'page',
    label: p.title,
    icon: p.icon,
    group: p.path.includes('/') ? p.path.slice(0, p.path.indexOf('/')) : '',
    degree: 0
  }))
  const edges: GraphEdge[] = []
  const pairs = new Set<string>()
  const add = (a: number, b: number, kind: GraphEdge['kind']): void => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    if (a === b || pairs.has(key)) return
    pairs.add(key)
    edges.push({ a, b, kind })
  }
  for (const [a, b] of data.links) add(a, b, 'link')
  if (opts.tags) {
    const tagIndex = new Map<string, number>()
    data.pages.forEach((p, i) => {
      for (const tag of p.tags) {
        let t = tagIndex.get(tag)
        if (t === undefined) {
          t = nodes.length
          tagIndex.set(tag, t)
          nodes.push({
            id: `#${tag}`,
            kind: 'tag',
            label: `#${tag}`,
            icon: null,
            group: '',
            degree: 0
          })
        }
        add(i, t, 'tag')
      }
    })
  }
  if (opts.ghosts) {
    for (const g of data.ghosts) {
      const n = nodes.length
      nodes.push({
        id: `?${g.title}`,
        kind: 'ghost',
        label: g.title,
        icon: null,
        group: '',
        degree: 0
      })
      for (const from of g.from) add(from, n, 'link')
    }
  }
  const adj: number[][] = nodes.map(() => [])
  for (const e of edges) {
    adj[e.a]!.push(e.b)
    adj[e.b]!.push(e.a)
  }
  nodes.forEach((n, i) => (n.degree = adj[i]!.length))
  return { nodes, edges, adj, byId: new Map(nodes.map((n, i) => [n.id, i])) }
}

export type Role = 'sun' | 'planet' | 'moon' | 'asteroid'

export interface Body {
  node: number
  role: Role
  /** Index of the body this one circles, -1 for a fixed body (a sun) */
  parent: number
  /** Fixed position for suns; orbit centre offset is the parent's position */
  x: number
  y: number
  z: number
  orbit: number
  phase: number
  /** Radians per second */
  speed: number
  /** Tilt of the orbit plane around the x and z axes */
  tiltX: number
  tiltZ: number
  size: number
}

export interface Layout {
  bodies: Body[]
  /** Body index per graph node, -1 when the node is not shown */
  bodyOf: Int32Array
  /** Radius that contains everything, for framing the camera */
  extent: number
  /** True when the local view left out nodes beyond the limit */
  truncated: boolean
}

/** Deterministic pseudo-random number in [0, 1) from a string. */
export function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // Final avalanche (MurmurHash3 fmix32): similar strings must not give similar numbers
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const sizeOf = (n: GraphNode): number =>
  (n.kind === 'ghost' ? 0.35 : 0.55) + Math.min(1.6, Math.sqrt(n.degree) * 0.22)

/** Orbital speed falls with distance, roughly like Kepler's third law. */
const speedFor = (orbit: number): number => 1.8 / Math.pow(Math.max(orbit, 1), 1.5)

/**
 * Spreads `count` bodies over rings starting at `first`, `gap` apart, so that neighbours on a
 * ring keep at least `spacing` distance. Returns [ring radius, angle] per body.
 */
export function rings(
  count: number,
  first: number,
  gap: number,
  spacing: number
): [number, number][] {
  const out: [number, number][] = []
  let r = first
  let left = count
  while (left > 0) {
    const fits = Math.max(1, Math.floor((2 * Math.PI * r) / spacing))
    const n = Math.min(fits, left)
    // Offset each ring a little so the rings don't line up into spokes
    const offset = r * 0.37
    for (let i = 0; i < n; i++) out.push([r, offset + (i / n) * Math.PI * 2])
    left -= n
    r += gap
  }
  return out
}

function makeBody(node: number, role: Role, parent: number, size: number): Body {
  return {
    node,
    role,
    parent,
    x: 0,
    y: 0,
    z: 0,
    orbit: 0,
    phase: 0,
    speed: 0,
    tiltX: 0,
    tiltZ: 0,
    size
  }
}

/**
 * Local view: `center` is the sun, its neighbours planets, their neighbours moons (and so on up
 * to `depth`). Each node appears once, attached to the neighbour it was first reached from.
 */
export function localLayout(g: Graph, center: number, depth: number, limit = 900): Layout {
  const bodies: Body[] = []
  const bodyOf = new Int32Array(g.nodes.length).fill(-1)
  const sun = makeBody(
    center,
    'sun',
    -1,
    2.4 + Math.min(1.5, Math.sqrt(g.nodes[center]!.degree) * 0.15)
  )
  bodies.push(sun)
  bodyOf[center] = 0
  const byDegree = (a: number, b: number): number =>
    g.nodes[b]!.degree - g.nodes[a]!.degree || g.nodes[a]!.label.localeCompare(g.nodes[b]!.label)

  let truncated = false
  let frontier = [0]
  let extent = sun.size
  for (let level = 1; level <= depth && frontier.length; level++) {
    const next: number[] = []
    for (const parentBody of frontier) {
      const children = g.adj[bodies[parentBody]!.node]!.filter((n) => bodyOf[n] === -1).sort(
        byDegree
      )
      if (!children.length) continue
      if (bodies.length + children.length > limit) {
        truncated = true
        children.length = Math.max(0, limit - bodies.length)
      }
      const parent = bodies[parentBody]!
      const role: Role = level === 1 ? 'planet' : 'moon'
      const scale = level === 1 ? 1 : 0.45 / (level - 1)
      const first = level === 1 ? sun.size + 7 : parent.size + 2.2 * scale + 1
      const placed = rings(
        children.length,
        first,
        level === 1 ? 5 : 1.6 * scale + 0.6,
        level === 1 ? 4.2 : 1.7 * scale + 0.5
      )
      // Moons circle in their own tilted plane, planets close to the ecliptic
      const tilt = hash01(g.nodes[parent.node]!.id) * Math.PI
      children.forEach((n, i) => {
        const [orbit, angle] = placed[i]!
        const b = makeBody(n, role, parentBody, sizeOf(g.nodes[n]!) * (level === 1 ? 1 : 0.75))
        b.orbit = orbit
        b.phase = angle
        b.speed = speedFor(orbit * (level === 1 ? 1 : 4))
        b.tiltX = level === 1 ? (hash01(`ring${orbit}x`) - 0.5) * 0.25 : Math.sin(tilt) * 0.9
        b.tiltZ = level === 1 ? (hash01(`ring${orbit}z`) - 0.5) * 0.25 : Math.cos(tilt) * 0.9
        bodyOf[n] = bodies.length
        next.push(bodies.length)
        bodies.push(b)
      })
      if (level === 1) extent = Math.max(extent, placed[placed.length - 1]![0])
    }
    frontier = next
  }
  // Moons add to the outermost planet's orbit at most a few units
  return { bodies, bodyOf, extent: extent + 6, truncated }
}

/**
 * Groups of densely connected nodes (Louvain modularity optimisation). Links count fully, tag
 * memberships less, so one popular tag doesn't swallow the vault. Deterministic: fixed visiting
 * order, and a node only moves for a strictly better gain.
 */
export function communities(g: Graph): Int32Array {
  // Weighted adjacency of the current level; starts as the graph itself
  let size = g.nodes.length
  let adj: Map<number, number>[] = Array.from({ length: size }, () => new Map())
  let selfLoop = new Float64Array(size)
  for (const e of g.edges) {
    const w = e.kind === 'tag' ? 0.35 : 1
    adj[e.a]!.set(e.b, (adj[e.a]!.get(e.b) ?? 0) + w)
    adj[e.b]!.set(e.a, (adj[e.b]!.get(e.a) ?? 0) + w)
  }
  const member = new Int32Array(g.nodes.length)
  for (let i = 0; i < member.length; i++) member[i] = i

  for (let level = 0; level < 10; level++) {
    const k = new Float64Array(size)
    let m2 = 0
    for (let i = 0; i < size; i++) {
      for (const w of adj[i]!.values()) k[i] = k[i]! + w
      k[i] = k[i]! + 2 * selfLoop[i]!
      m2 += k[i]!
    }
    if (!m2) break
    const comm = new Int32Array(size)
    const tot = new Float64Array(size)
    for (let i = 0; i < size; i++) {
      comm[i] = i
      tot[i] = k[i]!
    }
    const order = [...Array(size).keys()].sort((a, b) => k[b]! - k[a]! || a - b)
    let movedAny = false
    for (let sweep = 0; sweep < 30; sweep++) {
      let moved = false
      for (const i of order) {
        const own = comm[i]!
        tot[own] = tot[own]! - k[i]!
        const toComm = new Map<number, number>()
        for (const [j, w] of adj[i]!) toComm.set(comm[j]!, (toComm.get(comm[j]!) ?? 0) + w)
        let best = own
        let bestGain = (toComm.get(own) ?? 0) - (tot[own]! * k[i]!) / m2
        for (const [c, w] of toComm) {
          const gain = w - (tot[c]! * k[i]!) / m2
          if (gain > bestGain + 1e-12) {
            best = c
            bestGain = gain
          }
        }
        comm[i] = best
        tot[best] = tot[best]! + k[i]!
        if (best !== own) moved = movedAny = true
      }
      if (!moved) break
    }
    if (!movedAny) break

    // Fold every community into one node and repeat on the smaller graph
    const renum = new Map<number, number>()
    for (let i = 0; i < size; i++) if (!renum.has(comm[i]!)) renum.set(comm[i]!, renum.size)
    for (let n = 0; n < member.length; n++) member[n] = renum.get(comm[member[n]!]!)!
    const next: Map<number, number>[] = Array.from({ length: renum.size }, () => new Map())
    const nextSelf = new Float64Array(renum.size)
    for (let i = 0; i < size; i++) {
      const ci = renum.get(comm[i]!)!
      nextSelf[ci] = nextSelf[ci]! + selfLoop[i]!
      for (const [j, w] of adj[i]!) {
        const cj = renum.get(comm[j]!)!
        if (ci === cj) nextSelf[ci] = nextSelf[ci]! + w / 2
        else next[ci]!.set(cj, (next[ci]!.get(cj) ?? 0) + w)
      }
    }
    size = renum.size
    adj = next
    selfLoop = nextSelf
  }
  return member
}

/**
 * Global view: every community is a solar system around its best-connected node, systems sit
 * on a spiral disc, and nodes without any connection form an asteroid belt around everything.
 */
export function globalLayout(g: Graph): Layout {
  const bodies: Body[] = []
  const bodyOf = new Int32Array(g.nodes.length).fill(-1)
  const label = communities(g)
  const groups = new Map<number, number[]>()
  const loners: number[] = []
  g.nodes.forEach((node, i) => {
    if (!node.degree) return loners.push(i)
    const list = groups.get(label[i]!)
    if (list) list.push(i)
    else groups.set(label[i]!, [i])
  })
  const systems = [...groups.values()].sort((a, b) => b.length - a.length || a[0]! - b[0]!)

  const placedSystems: { x: number; z: number; r: number }[] = []
  for (const members of systems) {
    const sunNode = members.reduce((best, i) =>
      g.nodes[i]!.degree > g.nodes[best]!.degree ||
      (g.nodes[i]!.degree === g.nodes[best]!.degree &&
        g.nodes[i]!.kind === 'page' &&
        g.nodes[best]!.kind !== 'page')
        ? i
        : best
    )
    // Rings by distance from the sun inside the system
    const inSystem = new Set(members)
    const dist = new Map<number, number>([[sunNode, 0]])
    const queue = [sunNode]
    while (queue.length) {
      const cur = queue.shift()!
      for (const nb of g.adj[cur]!)
        if (inSystem.has(nb) && !dist.has(nb)) {
          dist.set(nb, dist.get(cur)! + 1)
          queue.push(nb)
        }
    }
    const maxDist = Math.max(1, ...dist.values())
    const byLevel = new Map<number, number[]>()
    for (const i of members) {
      if (i === sunNode) continue
      const d = dist.get(i) ?? maxDist + 1
      const list = byLevel.get(d)
      if (list) list.push(i)
      else byLevel.set(d, [i])
    }

    const sunSize = members.length > 1 ? 1.6 + Math.min(2.2, Math.sqrt(members.length) * 0.3) : 0.9
    const sunIndex = bodies.length
    const sun = makeBody(sunNode, 'sun', -1, sunSize)
    bodies.push(sun)
    bodyOf[sunNode] = sunIndex

    let r = sunSize + 3
    const tiltSeed = hash01(g.nodes[sunNode]!.id)
    for (const level of [...byLevel.keys()].sort((a, b) => a - b)) {
      const list = byLevel
        .get(level)!
        .sort((a, b) => g.nodes[b]!.degree - g.nodes[a]!.degree || a - b)
      const placed = rings(list.length, r, 2.4, 2.6)
      list.forEach((n, k) => {
        const [orbit, angle] = placed[k]!
        const b = makeBody(n, 'planet', sunIndex, sizeOf(g.nodes[n]!))
        b.orbit = orbit
        b.phase = angle
        b.speed = speedFor(orbit) * 0.6
        b.tiltX = (tiltSeed - 0.5) * 0.5
        b.tiltZ = (hash01(g.nodes[sunNode]!.id + 'z') - 0.5) * 0.5
        bodyOf[n] = bodies.length
        bodies.push(b)
      })
      r = placed[placed.length - 1]![0] + 3
    }
    const radius = r

    // Place the system: golden-angle spiral, pushed outwards until it overlaps nothing
    const k = placedSystems.length
    const angle = k * 2.399963
    let d = k ? placedSystems[0]!.r + radius + 10 : 0
    let x = 0
    let z = 0
    for (;;) {
      x = Math.cos(angle) * d
      z = Math.sin(angle) * d
      if (placedSystems.every((s) => Math.hypot(s.x - x, s.z - z) >= s.r + radius + 10)) break
      d += 3
    }
    placedSystems.push({ x, z, r: radius })
    sun.x = x
    sun.z = z
    sun.y = (hash01(g.nodes[sunNode]!.id + 'y') - 0.5) * Math.min(30, d * 0.15)
  }

  let extent = placedSystems.reduce((m, s) => Math.max(m, Math.hypot(s.x, s.z) + s.r), 10)
  if (loners.length) {
    // The asteroid belt: a slow, slightly scattered ring around all systems
    const centre = makeBody(-1, 'sun', -1, 0)
    const centreIndex = bodies.length
    bodies.push(centre)
    const belt = extent + 14
    loners.forEach((n, k) => {
      const id = g.nodes[n]!.id
      const b = makeBody(n, 'asteroid', centreIndex, sizeOf(g.nodes[n]!) * 0.8)
      b.orbit = belt + (hash01(id + 'r') - 0.5) * 10
      b.phase = (k / loners.length) * Math.PI * 2 + hash01(id) * 0.2
      b.speed = 0.02 + hash01(id + 's') * 0.01
      b.y = (hash01(id + 'y') - 0.5) * 4
      bodyOf[n] = bodies.length
      bodies.push(b)
    })
    extent = belt + 8
  }
  return { bodies, bodyOf, extent, truncated: false }
}

/**
 * World positions of all bodies at time `t` (seconds), written into `out` (x, y, z per body).
 * Parents always come before their children, so one pass suffices.
 */
export function positions(bodies: Body[], t: number, out: Float32Array): void {
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]!
    if (b.parent < 0) {
      out[i * 3] = b.x
      out[i * 3 + 1] = b.y
      out[i * 3 + 2] = b.z
      continue
    }
    const a = b.phase + t * b.speed
    // Circle in the x/z plane, tilted around x, then z
    const cx = Math.cos(a) * b.orbit
    const cz = Math.sin(a) * b.orbit
    const y1 = -Math.sin(b.tiltX) * cz
    const z1 = Math.cos(b.tiltX) * cz
    const x2 = Math.cos(b.tiltZ) * cx - Math.sin(b.tiltZ) * y1
    const y2 = Math.sin(b.tiltZ) * cx + Math.cos(b.tiltZ) * y1
    const p = b.parent * 3
    out[i * 3] = out[p]! + x2
    out[i * 3 + 1] = out[p + 1]! + y2 + b.y
    out[i * 3 + 2] = out[p + 2]! + z1
  }
}
