/**
 * Small, targeted edits to the Mermaid code of UML diagrams, for building them by drag and drop.
 * The code stays the only truth: each edit adds a line or two and leaves everything the author
 * wrote (order, indentation, comments) as it is. No DOM in here, so all of it is testable.
 */

export type DiagramType = 'class' | 'sequence' | 'state' | 'activity' | 'er'

export const DIAGRAM_TYPES: DiagramType[] = ['class', 'sequence', 'state', 'activity', 'er']

const HEADERS: Record<DiagramType, { detect: RegExp; start: string }> = {
  class: { detect: /^classDiagram(-v2)?\b/, start: 'classDiagram' },
  sequence: { detect: /^sequenceDiagram\b/, start: 'sequenceDiagram' },
  state: { detect: /^stateDiagram(-v2)?\b/, start: 'stateDiagram-v2' },
  activity: { detect: /^(flowchart|graph)\b/, start: 'flowchart TD' },
  er: { detect: /^erDiagram\b/, start: 'erDiagram' }
}

function meaningfulLines(source: string): string[] {
  return source.split('\n').filter((l) => l.trim() && !l.trim().startsWith('%%'))
}

/** Which diagram the code is (by its first line that isn't blank or a comment), if any we build. */
export function diagramType(source: string): DiagramType | null {
  const first = meaningfulLines(source)[0]?.trim() ?? ''
  return DIAGRAM_TYPES.find((t) => HEADERS[t].detect.test(first)) ?? null
}

/** Where a node of the rendered SVG comes from, by the id Mermaid gives it. */
export function nodeNameFromId(type: DiagramType, id: string): string | null {
  const pattern = {
    class: /-classId-(.+)-\d+$/,
    state: /-state-(.+)-\d+$/,
    activity: /-flowchart-(.+)-\d+$/,
    er: /-entity-(.+)-\d+$/,
    sequence: null
  }[type]
  const name = pattern?.exec(id)?.[1] ?? null
  // Start and end points (`root_start`, or `<parent>_end` inside a composite state) are both
  // [*] in the code
  if (type === 'state' && name && /_(start|end)$/.test(name)) return '[*]'
  return name
}

/** The indentation the author uses below the first line, two spaces if there is none yet. */
function indentOf(source: string): string {
  const line = meaningfulLines(source).find((l, i) => i > 0 && /^\s+\S/.test(l))
  return line ? /^\s+/.exec(line)![0] : '  '
}

/** A name Mermaid accepts as an id: letters, digits and underscores, not starting with a digit. */
function identifier(base: string): string {
  const plain = base
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9_]/g, '')
  return /^[A-Za-z_]/.test(plain) ? plain : `N${plain}`
}

/** `base`, or `base2`, `base3` … whichever doesn't appear in the code yet. */
export function freeName(source: string, base: string): string {
  const name = identifier(base)
  const taken = (n: string): boolean => new RegExp(`\\b${n}\\b`).test(source)
  if (!taken(name)) return name
  let i = 2
  while (taken(`${name}${i}`)) i++
  return `${name}${i}`
}

/** Starts a new diagram of the given type, or returns the code if it already is one. */
export function startDiagram(source: string, type: DiagramType): string {
  return diagramType(source) ? source : HEADERS[type].start
}

function append(source: string, type: DiagramType, lines: string[]): string {
  const body = source.replace(/\s+$/, '')
  const head = diagramType(body)
    ? body
    : body
      ? `${HEADERS[type].start}\n${body}`
      : HEADERS[type].start
  return `${head}\n${lines.join('\n')}`
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Adds a line into the `{ … }` body that follows `head` (a class, an entity), turning a bare
 * `head` line into one with a body, or appending a new block if there is neither yet.
 */
function addToBody(
  source: string,
  type: DiagramType,
  head: string,
  name: string,
  line: string
): string {
  const lines = source.split('\n')
  const pad = indentOf(source)
  const prefix = head ? `${escape(head)}\\s+` : ''
  const open = lines.findIndex((l) =>
    new RegExp(`^\\s*${prefix}${escape(name)}\\b[^{]*\\{\\s*$`).test(l)
  )
  if (open >= 0) {
    const close = lines.findIndex((l, i) => i > open && l.trim() === '}')
    if (close >= 0) {
      const inner = lines.slice(open + 1, close).find((l) => l.trim())
      const at = inner ? /^\s*/.exec(inner)![0] : /^\s*/.exec(lines[open]!)![0] + pad
      lines.splice(close, 0, `${at}${line}`)
      return lines.join('\n')
    }
  }
  const bare = lines.findIndex((l) => new RegExp(`^\\s*${prefix}${escape(name)}\\s*$`).test(l))
  if (bare >= 0) {
    const at = /^\s*/.exec(lines[bare]!)![0]
    lines.splice(bare, 1, `${lines[bare]!.trimEnd()} {`, `${at}${pad}${line}`, `${at}}`)
    return lines.join('\n')
  }
  const opener = head ? `${head} ${name}` : name
  return append(source, type, [`${pad}${opener} {`, `${pad}${pad}${line}`, `${pad}}`])
}

// ── Class diagram ────────────────────────────────────────────────────────────

export type ClassKind = 'class' | 'interface' | 'abstract' | 'enum'
export type ClassRelation =
  'inheritance' | 'realization' | 'association' | 'dependency' | 'aggregation' | 'composition'

const ANNOTATION: Record<ClassKind, string | null> = {
  class: null,
  interface: '<<interface>>',
  abstract: '<<abstract>>',
  enum: '<<enumeration>>'
}

export function addClass(source: string, kind: ClassKind, base: string): string {
  const name = freeName(source, base)
  const pad = indentOf(source)
  const annotation = ANNOTATION[kind]
  const lines = annotation
    ? [`${pad}class ${name} {`, `${pad}${pad}${annotation}`, `${pad}}`]
    : [`${pad}class ${name}`]
  return append(source, 'class', lines)
}

/** An attribute or method, into the class body. */
export function addClassMember(source: string, className: string, member: string): string {
  return addToBody(source, 'class', 'class', className, member)
}

/**
 * `from` is where the drag started: the subclass for inheritance and realization, the whole for
 * aggregation and composition, the user for association and dependency.
 */
export function addClassRelation(
  source: string,
  from: string,
  to: string,
  kind: ClassRelation
): string {
  if (from === to) return source
  const line = {
    inheritance: `${to} <|-- ${from}`,
    realization: `${to} <|.. ${from}`,
    association: `${from} --> ${to}`,
    dependency: `${from} ..> ${to}`,
    aggregation: `${from} o-- ${to}`,
    composition: `${from} *-- ${to}`
  }[kind]
  return append(source, 'class', [`${indentOf(source)}${line}`])
}

// ── Sequence diagram ─────────────────────────────────────────────────────────

export type ParticipantKind = 'participant' | 'actor'
export type MessageKind = 'sync' | 'reply' | 'async'

export function addParticipant(source: string, kind: ParticipantKind, base: string): string {
  return append(source, 'sequence', [`${indentOf(source)}${kind} ${freeName(source, base)}`])
}

/** A message from one lifeline to another, or to itself. */
export function addMessage(
  source: string,
  from: string,
  to: string,
  kind: MessageKind,
  text: string
): string {
  const arrow = { sync: '->>', reply: '-->>', async: '-)' }[kind]
  return append(source, 'sequence', [`${indentOf(source)}${from}${arrow}${to}: ${text}`])
}

export function addSequenceNote(source: string, participant: string, text: string): string {
  return append(source, 'sequence', [`${indentOf(source)}Note right of ${participant}: ${text}`])
}

// ── State diagram ────────────────────────────────────────────────────────────

export type StateKind = 'state' | 'choice' | 'fork' | 'join'

export function addState(source: string, kind: StateKind, base: string): string {
  const name = freeName(source, base)
  const line = kind === 'state' ? name : `state ${name} <<${kind}>>`
  return append(source, 'state', [`${indentOf(source)}${line}`])
}

/** Marks a state as where it all starts (`[*] --> S`) or ends (`S --> [*]`). */
export function addStateEnd(source: string, state: string, end: 'start' | 'end'): string {
  if (state === '[*]') return source
  const line = end === 'start' ? `[*] --> ${state}` : `${state} --> [*]`
  return append(source, 'state', [`${indentOf(source)}${line}`])
}

export function addTransition(source: string, from: string, to: string): string {
  if (from === '[*]' && to === '[*]') return source
  return append(source, 'state', [`${indentOf(source)}${from} --> ${to}`])
}

export function addStateNote(source: string, state: string, text: string): string {
  if (state === '[*]') return source
  return append(source, 'state', [`${indentOf(source)}note right of ${state} : ${text}`])
}

// ── Activity diagram (flowchart) ─────────────────────────────────────────────

export type ActivityShape = 'start' | 'action' | 'decision' | 'end' | 'subprocess' | 'data'
export type FlowKind = 'arrow' | 'dotted' | 'thick'

const SHAPES: Record<ActivityShape, [string, string]> = {
  start: ['((', '))'],
  action: ['(', ')'],
  decision: ['{', '}'],
  end: ['(((', ')))'],
  subprocess: ['[[', ']]'],
  data: ['[/', '/]']
}

/** A node with a fresh id; the label is what the diagram shows and can be edited in the code. */
export function addActivity(
  source: string,
  shape: ActivityShape,
  base: string,
  label: string
): string {
  const id = freeName(source, base)
  const [open, close] = SHAPES[shape]
  const text = label.replace(/"/g, "'")
  return append(source, 'activity', [`${indentOf(source)}${id}${open}"${text}"${close}`])
}

export function addFlow(source: string, from: string, to: string, kind: FlowKind): string {
  if (from === to) return source
  const arrow = { arrow: '-->', dotted: '-.->', thick: '==>' }[kind]
  return append(source, 'activity', [`${indentOf(source)}${from} ${arrow} ${to}`])
}

// ── Entity relationship diagram ──────────────────────────────────────────────

export type Cardinality = 'one-one' | 'one-many' | 'many-many' | 'zero-one'

export function addEntity(source: string, base: string, firstAttribute: string): string {
  const name = freeName(source, base)
  const pad = indentOf(source)
  return append(source, 'er', [`${pad}${name} {`, `${pad}${pad}${firstAttribute}`, `${pad}}`])
}

export function addEntityAttribute(source: string, entity: string, attribute: string): string {
  return addToBody(source, 'er', '', entity, attribute)
}

export function addRelationship(
  source: string,
  from: string,
  to: string,
  kind: Cardinality,
  label: string
): string {
  if (from === to) return source
  const symbol = {
    'one-one': '||--||',
    'one-many': '||--o{',
    'many-many': '}o--o{',
    'zero-one': '|o--||'
  }[kind]
  const text = /^[\w-]+$/.test(label) ? label : `"${label.replace(/"/g, "'")}"`
  return append(source, 'er', [`${indentOf(source)}${from} ${symbol} ${to} : ${text}`])
}
