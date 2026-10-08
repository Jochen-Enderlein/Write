/**
 * To-dos in page text: `- [ ] Angebot schicken 📅 2026-10-20`. The due date uses the
 * Obsidian Tasks marker, so vaults shared with Obsidian keep working.
 */

/** A list item with a checkbox; groups: indent and bullet, mark, text. */
const TASK_RE = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\](\s+)(.*)$/
const DUE_RE = /\s*📅\s*(\d{4}-\d{2}-\d{2})/u
const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/

export interface Task {
  /** 0-based line in the whole file (frontmatter included). */
  line: number
  /** The task's text without checkbox and due date. */
  text: string
  done: boolean
  due: string | null
}

export function parseTaskLine(line: string): Omit<Task, 'line'> | null {
  const m = TASK_RE.exec(line.replace(/\r$/, ''))
  if (!m) return null
  const rest = m[4]!
  const due = DUE_RE.exec(rest)
  return {
    text: rest.replace(DUE_RE, '').trim(),
    done: m[2] !== ' ',
    due: due ? due[1]! : null
  }
}

/** Every task in a file, skipping fenced code. */
export function extractTasks(raw: string): Task[] {
  const out: Task[] = []
  let fence: string | null = null
  raw.split('\n').forEach((line, i) => {
    const f = FENCE_RE.exec(line)
    if (f) {
      const marker = f[1]!
      if (fence === null) fence = marker
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null
      return
    }
    if (fence !== null) return
    const task = parseTaskLine(line)
    if (task) out.push({ line: i, ...task })
  })
  return out
}

export interface TaskChange {
  done?: boolean
  /** `null` removes the due date. */
  due?: string | null
  text?: string
}

/**
 * Applies a change to the task at `line`, but only if that line is still the task the caller
 * saw (`expected` text); otherwise returns null so nothing is overwritten.
 */
export function updateTaskInText(
  raw: string,
  line: number,
  expected: string,
  change: TaskChange
): string | null {
  const lines = raw.split('\n')
  const current = lines[line]
  if (current === undefined) return null
  const cr = current.endsWith('\r') ? '\r' : ''
  const m = TASK_RE.exec(current.replace(/\r$/, ''))
  const task = current ? parseTaskLine(current) : null
  if (!m || !task || task.text !== expected) return null
  const done = change.done ?? task.done
  const due = change.due !== undefined ? change.due : task.due
  const text = change.text?.trim() || task.text
  lines[line] =
    `${m[1]}[${done ? (m[2] === ' ' ? 'x' : m[2]) : ' '}]${m[3]}${text}` +
    (due ? ` 📅 ${due}` : '') +
    cr
  return lines.join('\n')
}
