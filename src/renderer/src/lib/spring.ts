/**
 * A tiny interruptible spring, parameterised like Apple's: `damping` ratio (1 = no overshoot)
 * and `response` in seconds. Re-targeting keeps the current value and velocity, so a motion
 * can be grabbed and reversed at any time without a jump.
 */
export interface SpringOptions {
  damping?: number
  response?: number
}

export interface Spring {
  readonly value: number
  readonly velocity: number
  to(target: number, opts?: SpringOptions & { velocity?: number }): void
  set(value: number): void
  stop(): void
}

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function createSpring(
  initial: number,
  onUpdate: (v: number) => void,
  onRest?: (v: number) => void
): Spring {
  let value = initial
  let velocity = 0
  let target = initial
  let k = 0
  let c = 0
  let raf = 0
  let last = 0

  const step = (now: number): void => {
    let dt = Math.min(0.064, (now - last) / 1000)
    last = now
    // Sub-steps keep the integration stable for stiff springs
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240)
      const force = -k * (value - target) - c * velocity
      velocity += force * h
      value += velocity * h
      dt -= h
    }
    if (Math.abs(value - target) < 0.05 && Math.abs(velocity) < 0.5) {
      value = target
      velocity = 0
      raf = 0
      onUpdate(value)
      onRest?.(value)
      return
    }
    onUpdate(value)
    raf = requestAnimationFrame(step)
  }

  return {
    get value() {
      return value
    },
    get velocity() {
      return velocity
    },
    to(t, opts = {}) {
      target = t
      if (opts.velocity !== undefined) velocity = opts.velocity
      if (prefersReducedMotion()) {
        cancelAnimationFrame(raf)
        raf = 0
        value = t
        velocity = 0
        onUpdate(value)
        onRest?.(value)
        return
      }
      const damping = opts.damping ?? 1
      const response = opts.response ?? 0.35
      k = Math.pow((2 * Math.PI) / response, 2)
      c = (4 * Math.PI * damping) / response
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(step)
      }
    },
    set(v) {
      cancelAnimationFrame(raf)
      raf = 0
      value = v
      target = v
      velocity = 0
      onUpdate(v)
    },
    stop() {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }
}

/** Progressive resistance past a boundary instead of a hard stop. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

/** Tracks recent pointer samples to estimate release velocity (px/s). */
export class VelocityTracker {
  private samples: { t: number; x: number }[] = []
  add(x: number, t = performance.now()): void {
    this.samples.push({ t, x })
    while (this.samples.length > 2 && t - this.samples[0]!.t > 100) this.samples.shift()
  }
  velocity(): number {
    const a = this.samples[0]
    const b = this.samples[this.samples.length - 1]
    if (!a || !b || b.t === a.t) return 0
    return ((b.x - a.x) / (b.t - a.t)) * 1000
  }
  reset(): void {
    this.samples = []
  }
}

/** Where a flick would come to rest (Apple's scroll-deceleration projection). */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}
