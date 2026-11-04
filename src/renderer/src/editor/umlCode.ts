/**
 * Small, targeted edits to the Mermaid code of a UML class diagram, for building one by drag and
 * drop. The code stays the only truth: each edit adds a line or two and leaves everything the
 * author wrote (order, indentation, comments) as it is.
 */

export type ClassKind = 'class' | 'interface' | 'abstract' | 'enum'
export type MemberKind = 'attribute' | 'method'
export type RelationKind =
  'inheritance' | 'realization' | 'association' | 'dependency' | 'aggregation' | 'composition'

const ANNOTATION: Record<ClassKind, string | null> = {
  class: null,
  interface: '<<interface>>',
  abstract: '<<abstract>>',
  enum: '<<enumeration>>'
}

const HEADER = /^classDiagram(-v2)?\b/

function meaningfulLines(source: string): string[] {
  return source.split('\n').filter((l) => l.trim() && !l.trim().startsWith('%%'))
}

/** Whether the code is a class diagram (the first line that isn't blank or a comment says so). */
export function isClassDiagram(source: string): boolean {
  return HEADER.test(meaningfulLines(source)[0]?.trim() ?? '')
}

/** The class a rendered node stands for, from Mermaid's node id (`mermaid-3-classId-Kunde-0`). */
export function classNameFromNodeId(id: string): string | null {
  return /-classId-(.+)-\d+$/.exec(id)?.[1] ?? null
}

/** The indentation the author uses below `classDiagram`, two spaces if there is none yet. */
function indentOf(source: string): string {
  const line = meaningfulLines(source).find((l, i) => i > 0 && /^\s+\S/.test(l))
  return line ? /^\s+/.exec(line)![0] : '  '
}

/** A class name Mermaid accepts: letters, digits and underscores, not starting with a digit. */
function identifier(base: string): string {
  const plain = base
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9_]/g, '')
  return /^[A-Za-z_]/.test(plain) ? plain : `C${plain}`
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

function append(source: string, lines: string[]): string {
  const body = source.replace(/\s+$/, '')
  const head = isClassDiagram(body) ? body : body ? `classDiagram\n${body}` : 'classDiagram'
  return `${head}\n${lines.join('\n')}`
}

/** Adds a class of the given kind with a fresh name based on `base`. */
export function addClass(
  source: string,
  kind: ClassKind,
  base: string
): { source: string; name: string } {
  const name = freeName(source, base)
  const pad = indentOf(source)
  const annotation = ANNOTATION[kind]
  const lines = annotation
    ? [`${pad}class ${name} {`, `${pad}${pad}${annotation}`, `${pad}}`]
    : [`${pad}class ${name}`]
  return { source: append(source, lines), name }
}

/**
 * Adds an attribute or a method to a class: into its `{ … }` body, turning a bare `class Name`
 * into one with a body, or as a new class block if the class only appears in relations so far.
 */
export function addMember(source: string, className: string, member: string): string {
  const lines = source.split('\n')
  const pad = indentOf(source)
  const name = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const open = lines.findIndex((l) => new RegExp(`^\\s*class\\s+${name}\\b[^{]*\\{\\s*$`).test(l))
  if (open >= 0) {
    const close = lines.findIndex((l, i) => i > open && l.trim() === '}')
    if (close >= 0) {
      const inner = lines.slice(open + 1, close).find((l) => l.trim())
      const at = inner ? /^\s*/.exec(inner)![0] : /^\s*/.exec(lines[open]!)![0] + pad
      lines.splice(close, 0, `${at}${member}`)
      return lines.join('\n')
    }
  }
  const bare = lines.findIndex((l) => new RegExp(`^\\s*class\\s+${name}\\s*$`).test(l))
  if (bare >= 0) {
    const at = /^\s*/.exec(lines[bare]!)![0]
    lines.splice(bare, 1, `${lines[bare]!.trimEnd()} {`, `${at}${pad}${member}`, `${at}}`)
    return lines.join('\n')
  }
  return append(source, [`${pad}class ${className} {`, `${pad}${pad}${member}`, `${pad}}`])
}

/**
 * Connects two classes. `from` is where the drag started: the subclass for inheritance and
 * realization, the whole for aggregation and composition, the user for association and
 * dependency. Mermaid draws the arrowhead or diamond on the side the symbol stands.
 */
export function addRelation(source: string, from: string, to: string, kind: RelationKind): string {
  if (from === to) return source
  const line = {
    inheritance: `${to} <|-- ${from}`,
    realization: `${to} <|.. ${from}`,
    association: `${from} --> ${to}`,
    dependency: `${from} ..> ${to}`,
    aggregation: `${from} o-- ${to}`,
    composition: `${from} *-- ${to}`
  }[kind]
  return append(source, [`${indentOf(source)}${line}`])
}
