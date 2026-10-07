import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { hash01, positions, type Graph, type Layout } from './layout'

/**
 * Renders a laid-out graph as a solar system with three.js. All bodies of one kind share an
 * InstancedMesh and all links one LineSegments, so thousands of pages stay one handful of draw
 * calls. Picking works in screen space, which is forgiving for small, far-away planets.
 */

export interface SceneEvents {
  hover(node: number | null): void
  select(node: number | null): void
  open(node: number): void
}

const BACKGROUND = 0x04050b
const TAG_COLOR = new THREE.Color('#f2c14e')
const GHOST_COLOR = new THREE.Color('#7d8490')
const LINK_COLOR = new THREE.Color('#8fb4ff')
// Tag memberships are many and less telling than links, so they stay in the background
const TAG_LINK_COLOR = new THREE.Color('#f2c14e').multiplyScalar(0.4)

export function groupColor(group: string): THREE.Color {
  if (!group) return new THREE.Color('#7fb2ff')
  return new THREE.Color().setHSL(hash01(group), 0.62, 0.64)
}

type Kind = 'sun' | 'page' | 'tag' | 'ghost'

interface Batch {
  mesh: THREE.InstancedMesh
  bodies: number[]
}

export class GraphScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 6000)
  private controls: OrbitControls
  private world = new THREE.Group()
  private batches = new Map<Kind, Batch>()
  private halos: THREE.Sprite[] = []
  private haloBodies: number[] = []
  private rings: { line: THREE.LineLoop; parent: number }[] = []
  private links: THREE.LineSegments | null = null
  private linkPairs: [number, number][] = []
  private highlight: THREE.LineSegments
  private haloTexture = makeHaloTexture()
  private labels: HTMLSpanElement[] = []

  private graph: Graph | null = null
  private layout: Layout | null = null
  private pos = new Float32Array(0)
  private screen = new Float32Array(0)
  private time = 0
  private last = performance.now()
  private frame = 0
  private timeScale = 1
  private hovered: number | null = null
  private selected: number | null = null
  private followed: number | null = null
  private flight: {
    from: THREE.Vector3
    to: THREE.Vector3
    camFrom: THREE.Vector3
    camTo: THREE.Vector3
    start: number
    duration: number
  } | null = null
  private pointer: { x: number; y: number } | null = null
  private down: { x: number; y: number } | null = null
  private resize: ResizeObserver
  private motion = window.matchMedia('(prefers-reduced-motion: reduce)')

  constructor(
    private host: HTMLElement,
    private labelLayer: HTMLElement,
    private events: SceneEvents
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(BACKGROUND)
    host.appendChild(this.renderer.domElement)
    this.scene.add(this.world)
    this.scene.add(makeStars())
    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x10121c, 1.1))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(1, 1.2, 0.8)
    this.camera.add(key)
    this.scene.add(this.camera)

    this.highlight = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
    )
    this.highlight.frustumCulled = false
    this.world.add(this.highlight)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.rotateSpeed = 0.6
    this.controls.zoomSpeed = 0.9
    this.controls.addEventListener('start', () => {
      this.flight = null
    })

    const el = this.renderer.domElement
    el.addEventListener('pointermove', this.onMove)
    el.addEventListener('pointerleave', this.onLeave)
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointerup', this.onUp)
    el.addEventListener('dblclick', this.onDouble)
    this.timeScale = this.motion.matches ? 0 : 1
    this.motion.addEventListener('change', this.onMotion)

    this.resize = new ResizeObserver(() => this.fit())
    this.resize.observe(host)
    this.fit()
    this.frame = requestAnimationFrame(this.tick)
  }

  /** Shows a new layout; `focus` is the node the camera looks at first. */
  setData(graph: Graph, layout: Layout, keepCamera = false): void {
    this.graph = graph
    this.layout = layout
    this.hovered = null
    this.followed = null
    this.selected = null
    // A flight still heading for a body of the previous layout would end up in empty space
    this.flight = null
    this.clearWorld()
    const bodies = layout.bodies
    this.pos = new Float32Array(bodies.length * 3)
    this.screen = new Float32Array(bodies.length * 3)
    positions(bodies, this.time, this.pos)

    const kinds = new Map<Kind, number[]>()
    bodies.forEach((b, i) => {
      if (b.node < 0) return
      const node = graph.nodes[b.node]!
      const kind: Kind = b.role === 'sun' ? 'sun' : node.kind === 'page' ? 'page' : node.kind
      const list = kinds.get(kind)
      if (list) list.push(i)
      else kinds.set(kind, [i])
    })
    const sphere = new THREE.SphereGeometry(1, 28, 18)
    for (const [kind, list] of kinds) {
      const geometry = kind === 'tag' ? new THREE.OctahedronGeometry(1.15) : sphere
      const material =
        kind === 'sun'
          ? new THREE.MeshStandardMaterial({
              color: 0xffffff,
              emissive: 0xffffff,
              emissiveIntensity: 0.55,
              roughness: 0.9
            })
          : kind === 'ghost'
            ? new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })
            : new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.55,
                metalness: kind === 'tag' ? 0.35 : 0.05,
                emissive: kind === 'tag' ? TAG_COLOR : new THREE.Color(0x000000),
                emissiveIntensity: kind === 'tag' ? 0.25 : 0
              })
      const mesh = new THREE.InstancedMesh(geometry, material, list.length)
      mesh.frustumCulled = false
      list.forEach((bi, k) => mesh.setColorAt(k, this.colorOf(bi)))
      this.world.add(mesh)
      this.batches.set(kind, { mesh, bodies: list })
    }

    // Glow around every sun
    for (const bi of kinds.get('sun') ?? []) {
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.haloTexture,
          color: this.colorOf(bi).lerp(new THREE.Color(0xffffff), 0.35),
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      )
      const s = bodies[bi]!.size * 7
      halo.scale.set(s, s, 1)
      this.world.add(halo)
      this.halos.push(halo)
      this.haloBodies.push(bi)
    }

    // One orbit ring per distinct circle (shared by all bodies on it)
    const seen = new Set<string>()
    const ringMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.07
    })
    bodies.forEach((b) => {
      if (b.parent < 0 || b.role === 'asteroid') return
      const key = `${b.parent}|${b.orbit.toFixed(2)}|${b.tiltX.toFixed(3)}|${b.tiltZ.toFixed(3)}`
      if (seen.has(key)) return
      seen.add(key)
      const pts: THREE.Vector3[] = []
      const steps = Math.min(160, Math.max(48, Math.round(b.orbit * 6)))
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2
        pts.push(new THREE.Vector3(Math.cos(a) * b.orbit, 0, Math.sin(a) * b.orbit))
      }
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), ringMaterial)
      line.rotation.set(b.tiltX, 0, b.tiltZ, 'ZYX')
      this.world.add(line)
      this.rings.push({ line, parent: b.parent })
    })

    // Links between shown bodies
    this.linkPairs = []
    const colors: number[] = []
    for (const e of graph.edges) {
      const a = layout.bodyOf[e.a]!
      const b = layout.bodyOf[e.b]!
      if (a < 0 || b < 0) continue
      this.linkPairs.push([a, b])
      const c = e.kind === 'tag' ? TAG_LINK_COLOR : LINK_COLOR
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(this.linkPairs.length * 6), 3)
    )
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    this.links = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: bodies.length > 1500 ? 0.12 : 0.22,
        depthWrite: false
      })
    )
    this.links.frustumCulled = false
    this.world.add(this.links)
    this.highlight.geometry.dispose()
    this.highlight.geometry = new THREE.BufferGeometry()
    this.highlight.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(Math.max(1, this.linkPairs.length) * 6), 3)
    )

    this.update()
    if (!keepCamera) this.frameAll()
  }

  /** Smoothly moves the camera to a node and keeps it in view while it orbits. */
  focus(node: number, select = true): void {
    const bi = this.layout?.bodyOf[node] ?? -1
    if (bi < 0) return
    const b = this.layout!.bodies[bi]!
    const target = this.bodyPosition(bi)
    const distance = Math.max(14, b.size * 9 + (b.role === 'sun' ? b.size * 6 : 0))
    const dir = this.camera.position.clone().sub(this.controls.target).normalize()
    this.flyTo(target, target.clone().add(dir.multiplyScalar(distance)))
    this.followed = b.parent >= 0 ? bi : null
    if (select) this.setSelected(node)
  }

  setSelected(node: number | null): void {
    this.selected = node
    this.updateHighlight()
  }

  dispose(): void {
    cancelAnimationFrame(this.frame)
    this.resize.disconnect()
    this.motion.removeEventListener('change', this.onMotion)
    this.controls.dispose()
    this.clearWorld()
    this.haloTexture.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    for (const l of this.labels) l.remove()
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private colorOf(bi: number): THREE.Color {
    const node = this.graph!.nodes[this.layout!.bodies[bi]!.node]!
    if (node.kind === 'tag') return TAG_COLOR.clone()
    if (node.kind === 'ghost') return GHOST_COLOR.clone()
    const c = groupColor(node.group)
    return this.layout!.bodies[bi]!.role === 'sun' ? c.lerp(new THREE.Color('#fff4d6'), 0.55) : c
  }

  private bodyPosition(bi: number): THREE.Vector3 {
    return new THREE.Vector3(this.pos[bi * 3], this.pos[bi * 3 + 1], this.pos[bi * 3 + 2])
  }

  private clearWorld(): void {
    for (const { mesh } of this.batches.values()) {
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
      this.world.remove(mesh)
    }
    this.batches.clear()
    for (const h of this.halos) {
      h.material.dispose()
      this.world.remove(h)
    }
    this.halos = []
    this.haloBodies = []
    for (const { line } of this.rings) {
      line.geometry.dispose()
      this.world.remove(line)
    }
    this.rings = []
    if (this.links) {
      this.links.geometry.dispose()
      ;(this.links.material as THREE.Material).dispose()
      this.world.remove(this.links)
      this.links = null
    }
  }

  private frameAll(): void {
    const extent = this.layout?.extent ?? 30
    this.controls.target.set(0, 0, 0)
    // From above at an angle, so systems on the disc don't hide behind each other
    this.camera.position.set(0, extent * 1.25, extent * 1.05)
    this.controls.update()
  }

  private flyTo(target: THREE.Vector3, cam: THREE.Vector3): void {
    if (this.motion.matches) {
      this.controls.target.copy(target)
      this.camera.position.copy(cam)
      return
    }
    this.flight = {
      from: this.controls.target.clone(),
      to: target,
      camFrom: this.camera.position.clone(),
      camTo: cam,
      start: performance.now(),
      duration: 750
    }
  }

  private fit(): void {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private tick = (now: number): void => {
    this.frame = requestAnimationFrame(this.tick)
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    this.time += dt * this.timeScale

    const prevFollowed = this.followed !== null ? this.bodyPosition(this.followed) : null
    this.update()
    if (this.followed !== null && prevFollowed && !this.flight) {
      const delta = this.bodyPosition(this.followed).sub(prevFollowed)
      this.controls.target.add(delta)
      this.camera.position.add(delta)
    }
    if (this.flight) {
      const f = this.flight
      const t = Math.min(1, (now - f.start) / f.duration)
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      // Flying to a moving body: aim at where it is now
      const to = this.followed !== null ? this.bodyPosition(this.followed) : f.to
      const camTo = f.camTo.clone().add(to.clone().sub(f.to))
      this.controls.target.lerpVectors(f.from, to, e)
      this.camera.position.lerpVectors(f.camFrom, camTo, e)
      if (t >= 1) this.flight = null
    }
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    this.updateLabels()
    if (this.pointer) this.pick(this.pointer.x, this.pointer.y)
  }

  /** Moves every body, ring, halo and link to the current time. */
  private update(): void {
    const layout = this.layout
    if (!layout) return
    positions(layout.bodies, this.time, this.pos)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    for (const { mesh, bodies } of this.batches.values()) {
      bodies.forEach((bi, k) => {
        const b = layout.bodies[bi]!
        const grow = b.node === this.hovered ? 1.35 : 1
        s.setScalar(b.size * grow)
        p.set(this.pos[bi * 3]!, this.pos[bi * 3 + 1]!, this.pos[bi * 3 + 2]!)
        mesh.setMatrixAt(k, m.compose(p, q, s))
      })
      mesh.instanceMatrix.needsUpdate = true
    }
    this.halos.forEach((h, k) => h.position.copy(this.bodyPosition(this.haloBodies[k]!)))
    for (const { line, parent } of this.rings) line.position.copy(this.bodyPosition(parent))
    if (this.links) {
      const attr = this.links.geometry.getAttribute('position') as THREE.BufferAttribute
      const arr = attr.array as Float32Array
      this.linkPairs.forEach(([a, b], k) => {
        arr.set(this.pos.subarray(a * 3, a * 3 + 3), k * 6)
        arr.set(this.pos.subarray(b * 3, b * 3 + 3), k * 6 + 3)
      })
      attr.needsUpdate = true
    }
    this.updateHighlight()
  }

  /** Bright lines for the links of the hovered or selected node. */
  private updateHighlight(): void {
    const layout = this.layout
    const node = this.hovered ?? this.selected
    if (!layout || node === null) {
      this.highlight.visible = false
      return
    }
    const bi = layout.bodyOf[node]!
    const attr = this.highlight.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    let n = 0
    for (const [a, b] of this.linkPairs) {
      if (a !== bi && b !== bi) continue
      arr.set(this.pos.subarray(a * 3, a * 3 + 3), n * 6)
      arr.set(this.pos.subarray(b * 3, b * 3 + 3), n * 6 + 3)
      n++
    }
    attr.needsUpdate = true
    this.highlight.geometry.setDrawRange(0, n * 2)
    this.highlight.visible = n > 0
  }

  /** Projects all bodies once per frame; used for labels and picking. */
  private project(): void {
    const layout = this.layout
    if (!layout) return
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    const v = new THREE.Vector3()
    const scale = h / (2 * Math.tan((this.camera.fov * Math.PI) / 360))
    for (let i = 0; i < layout.bodies.length; i++) {
      v.set(this.pos[i * 3]!, this.pos[i * 3 + 1]!, this.pos[i * 3 + 2]!)
      const dist = v.distanceTo(this.camera.position)
      v.project(this.camera)
      const visible = v.z < 1 && layout.bodies[i]!.node >= 0
      this.screen[i * 3] = visible ? ((v.x + 1) / 2) * w : -1e6
      this.screen[i * 3 + 1] = ((1 - v.y) / 2) * h
      // Radius on screen in pixels
      this.screen[i * 3 + 2] = (layout.bodies[i]!.size / Math.max(dist, 0.001)) * scale
    }
  }

  private updateLabels(): void {
    const layout = this.layout
    const graph = this.graph
    if (!layout || !graph) return
    this.project()
    // Suns, the hovered and selected node, and planets that are large enough on screen
    const wanted: { bi: number; weight: number }[] = []
    layout.bodies.forEach((b, i) => {
      if (b.node < 0 || this.screen[i * 3]! < -1e5) return
      const r = this.screen[i * 3 + 2]!
      const special = b.node === this.hovered || b.node === this.selected
      if (special || b.role === 'sun' || r > 4.5)
        wanted.push({ bi: i, weight: special ? 1e9 : (b.role === 'sun' ? 1e6 : 0) + r })
    })
    wanted.sort((a, b) => b.weight - a.weight)
    // Most important first; a label that would overlap one already placed is left out
    const placed: [number, number][] = []
    const shown = wanted.filter(({ bi, weight }) => {
      if (placed.length >= 70) return false
      const x = this.screen[bi * 3]!
      const y = this.screen[bi * 3 + 1]! + this.screen[bi * 3 + 2]!
      if (weight < 1e9 && placed.some(([px, py]) => Math.abs(px - x) < 70 && Math.abs(py - y) < 15))
        return false
      placed.push([x, y])
      return true
    })
    wanted.length = 0
    wanted.push(...shown)
    while (this.labels.length < wanted.length) {
      const span = document.createElement('span')
      span.className = 'graph-label'
      this.labelLayer.appendChild(span)
      this.labels.push(span)
    }
    this.labels.forEach((span, k) => {
      const item = wanted[k]
      if (!item) {
        span.style.display = 'none'
        return
      }
      const b = layout.bodies[item.bi]!
      const node = graph.nodes[b.node]!
      const text = node.icon ? `${node.icon} ${node.label}` : node.label
      if (span.textContent !== text) span.textContent = text
      span.style.display = ''
      span.dataset.role = b.role
      span.dataset.active = String(b.node === this.hovered || b.node === this.selected)
      const x = this.screen[item.bi * 3]!
      const y = this.screen[item.bi * 3 + 1]! + this.screen[item.bi * 3 + 2]! + 6
      span.style.transform = `translate(${x}px, ${y}px) translateX(-50%)`
    })
  }

  private pick(x: number, y: number): void {
    const layout = this.layout
    if (!layout) return
    let best = -1
    let bestD = Infinity
    for (let i = 0; i < layout.bodies.length; i++) {
      const sx = this.screen[i * 3]!
      if (sx < -1e5) continue
      const d = Math.hypot(sx - x, this.screen[i * 3 + 1]! - y)
      const reach = Math.max(9, this.screen[i * 3 + 2]! + 4)
      if (d < reach && d - reach < bestD) {
        best = i
        bestD = d - reach
      }
    }
    const node = best >= 0 ? layout.bodies[best]!.node : null
    if (node !== this.hovered) {
      this.hovered = node
      this.renderer.domElement.style.cursor = node === null ? '' : 'pointer'
      this.events.hover(node)
    }
  }

  private local(e: PointerEvent | MouseEvent): { x: number; y: number } {
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private onMove = (e: PointerEvent): void => {
    this.pointer = this.local(e)
  }

  private onLeave = (): void => {
    this.pointer = null
    if (this.hovered !== null) {
      this.hovered = null
      this.events.hover(null)
    }
  }

  private onDown = (e: PointerEvent): void => {
    this.down = this.local(e)
  }

  private onUp = (e: PointerEvent): void => {
    const p = this.local(e)
    if (!this.down || Math.hypot(p.x - this.down.x, p.y - this.down.y) > 4) return
    this.down = null
    this.pick(p.x, p.y)
    this.events.select(this.hovered)
  }

  private onDouble = (e: MouseEvent): void => {
    const p = this.local(e)
    this.pick(p.x, p.y)
    if (this.hovered !== null) this.events.open(this.hovered)
  }

  private onMotion = (): void => {
    this.timeScale = this.motion.matches ? 0 : 1
  }
}

function makeStars(): THREE.Points {
  const count = 3000
  const arr = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    // Deterministic, evenly spread points on a large sphere, some brighter, some bluish
    const u = hash01(`star${i}u`) * 2 - 1
    const t = hash01(`star${i}t`) * Math.PI * 2
    const r = 2200 + hash01(`star${i}r`) * 800
    const s = Math.sqrt(1 - u * u)
    arr.set([Math.cos(t) * s * r, u * r, Math.sin(t) * s * r], i * 3)
    const b = 0.35 + Math.pow(hash01(`star${i}b`), 3) * 0.65
    const blue = hash01(`star${i}c`) * 0.15
    col.set([b * (1 - blue), b * (1 - blue / 2), b], i * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      vertexColors: true,
      size: 2,
      sizeAttenuation: false,
      transparent: true,
      depthWrite: false
    })
  )
}

function makeHaloTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.18, 'rgba(255,255,255,0.35)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.08)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
