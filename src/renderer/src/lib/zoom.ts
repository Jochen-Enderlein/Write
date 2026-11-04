/** Scale and offset of content shown in a viewport: screen = content × scale + (x, y). */
export interface ZoomView {
  scale: number
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export const MIN_SCALE = 0.1
export const MAX_SCALE = 8
/** Small diagrams grow to fill the screen, but not so far that their lines turn into bars. */
const MAX_FIT_SCALE = 3

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/** The whole content, centred, as large as fits with `padding` left on every side. */
export function fitView(
  content: Size,
  box: Size,
  padding = 32,
  maxScale = MAX_FIT_SCALE
): ZoomView {
  if (content.width <= 0 || content.height <= 0) return { scale: 1, x: 0, y: 0 }
  const room = {
    width: Math.max(1, box.width - 2 * padding),
    height: Math.max(1, box.height - 2 * padding)
  }
  const scale = clampScale(
    Math.min(room.width / content.width, room.height / content.height, maxScale)
  )
  return {
    scale,
    x: (box.width - content.width * scale) / 2,
    y: (box.height - content.height * scale) / 2
  }
}

/** Zooms by `factor` and keeps the content under `point` (viewport coordinates) where it is. */
export function zoomAt(view: ZoomView, factor: number, point: { x: number; y: number }): ZoomView {
  const scale = clampScale(view.scale * factor)
  const k = scale / view.scale
  return { scale, x: point.x - (point.x - view.x) * k, y: point.y - (point.y - view.y) * k }
}
