/** Undo and redo for the diagram editor: building steps one by one, typing in short runs. */
export interface History {
  past: string[]
  present: string
  future: string[]
  /** When the last change was typing, so the next keystrokes join the same step. */
  typedAt: number | null
}

const LIMIT = 200
/** Keystrokes closer together than this undo as one step. */
const RUN_MS = 1000

export function startHistory(present: string): History {
  return { past: [], present, future: [], typedAt: null }
}

export function record(h: History, next: string, typing: boolean, now: number): History {
  if (next === h.present) return h
  const joins = typing && h.typedAt !== null && now - h.typedAt < RUN_MS
  return {
    past: joins ? h.past : [...h.past, h.present].slice(-LIMIT),
    present: next,
    future: [],
    typedAt: typing ? now : null
  }
}

export function undo(h: History): History {
  const prev = h.past[h.past.length - 1]
  if (prev === undefined) return h
  return {
    past: h.past.slice(0, -1),
    present: prev,
    future: [h.present, ...h.future],
    typedAt: null
  }
}

export function redo(h: History): History {
  const next = h.future[0]
  if (next === undefined) return h
  return { past: [...h.past, h.present], present: next, future: h.future.slice(1), typedAt: null }
}
