interface Point {
  x: number
  y: number
}

/** How far the pointer may move between press and release for it to still count as a click. */
const SLOP = 4

/**
 * A press whose release the browser won't report as a click although the pointer stayed put:
 * the list changed in between (e.g. a synced page was added above) and another row now lies
 * under the pointer.
 */
export function missedRelease(down: Point, up: Point, releasedOnPressed: boolean): boolean {
  return !releasedOnPressed && Math.hypot(up.x - down.x, up.y - down.y) <= SLOP
}
