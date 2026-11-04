import { t } from '../../i18n'
import * as code from './code'
import type { DiagramType } from './code'

/** Something to drag from the palette: onto the canvas, or onto an element of the diagram. */
export interface Piece {
  id: string
  label: string
  target: 'canvas' | 'node'
  apply(source: string, node?: string): string
}

/** A kind of connection, drawn by dragging from one element to another. */
export interface Link {
  id: string
  label: string
  /** Hints at the line in UML notation; the full name is in the tooltip. */
  glyph: string
  hint: string
  apply(source: string, from: string, to: string): string
}

export interface Kit {
  type: DiagramType
  pieces: Piece[]
  links: Link[]
  /** The name in the code of the diagram element at a point of the rendered SVG. */
  nameAt(el: Element): string | null
  /** For diagrams whose elements are hard to hit: the one closest to a point, if near enough. */
  nearest?(root: Element, x: number, y: number): { node: Element; name: string } | null
}

const k = (key: string): string => t(`diagramEditor.${key}`)

function byNodeId(type: DiagramType): (el: Element) => string | null {
  return (el) => {
    const node = el.closest('g.node[id]')
    return node ? code.nodeNameFromId(type, node.id) : null
  }
}

function classKit(): Kit {
  const cls = (kind: code.ClassKind, label: string, base: string): Piece => ({
    id: kind,
    label: k(label),
    target: 'canvas',
    apply: (s) => code.addClass(s, kind, k(base))
  })
  const rel = (kind: code.ClassRelation, glyph: string): Link => ({
    id: kind,
    label: k(kind),
    glyph,
    hint: k(`${kind}Hint`),
    apply: (s, from, to) => code.addClassRelation(s, from, to, kind)
  })
  return {
    type: 'class',
    pieces: [
      cls('class', 'class', 'classBase'),
      cls('interface', 'interface', 'interfaceBase'),
      cls('abstract', 'abstract', 'abstractBase'),
      cls('enum', 'enum', 'enumBase'),
      {
        id: 'attribute',
        label: k('attribute'),
        target: 'node',
        apply: (s, node) =>
          code.addClassMember(s, node!, `+${code.freeName(s, k('attributeBase'))}: String`)
      },
      {
        id: 'method',
        label: k('method'),
        target: 'node',
        apply: (s, node) => code.addClassMember(s, node!, `+${code.freeName(s, k('methodBase'))}()`)
      }
    ],
    links: [
      rel('association', '—>'),
      rel('inheritance', '◁—'),
      rel('realization', '◁┄'),
      rel('dependency', '┄>'),
      rel('aggregation', '◇—'),
      rel('composition', '◆—')
    ],
    nameAt: byNodeId('class')
  }
}

function sequenceKit(): Kit {
  const msg = (kind: code.MessageKind, glyph: string): Link => ({
    id: kind,
    label: k(kind),
    glyph,
    hint: k(`${kind}Hint`),
    apply: (s, from, to) => code.addMessage(s, from, to, kind, k('messageText'))
  })
  return {
    type: 'sequence',
    pieces: [
      {
        id: 'participant',
        label: k('participant'),
        target: 'canvas',
        apply: (s) => code.addParticipant(s, 'participant', k('participantBase'))
      },
      {
        id: 'actor',
        label: k('actor'),
        target: 'canvas',
        apply: (s) => code.addParticipant(s, 'actor', k('actorBase'))
      },
      {
        id: 'note',
        label: k('note'),
        target: 'node',
        apply: (s, node) => code.addSequenceNote(s, node!, k('noteText'))
      }
    ],
    links: [msg('sync', '—▶'), msg('reply', '┄>'), msg('async', '—>')],
    // Participants and their lifelines carry the name as an attribute
    nameAt: (el) => el.closest('[name]')?.getAttribute('name') ?? null,
    // A stick figure or a thin lifeline is hard to hit; anywhere near a lifeline counts
    nearest: (root, x) => {
      let best: { node: Element; name: string; dx: number } | null = null
      for (const line of root.querySelectorAll('line.actor-line[name]')) {
        const r = line.getBoundingClientRect()
        const dx = Math.abs(r.left + r.width / 2 - x)
        const name = line.getAttribute('name')!
        if (dx < 60 && (!best || dx < best.dx)) {
          const head = root.querySelector(`[name="${CSS.escape(name)}"].actor-top`) ?? line
          best = { node: head, name, dx }
        }
      }
      return best && { node: best.node, name: best.name }
    }
  }
}

function stateKit(): Kit {
  const state = (kind: code.StateKind, label: string, base: string): Piece => ({
    id: kind,
    label: k(label),
    target: 'canvas',
    apply: (s) => code.addState(s, kind, k(base))
  })
  return {
    type: 'state',
    pieces: [
      state('state', 'state', 'stateBase'),
      state('choice', 'choice', 'choiceBase'),
      state('fork', 'fork', 'forkBase'),
      state('join', 'join', 'joinBase'),
      {
        id: 'start',
        label: k('start'),
        target: 'node',
        apply: (s, node) => code.addStateEnd(s, node!, 'start')
      },
      {
        id: 'end',
        label: k('end'),
        target: 'node',
        apply: (s, node) => code.addStateEnd(s, node!, 'end')
      },
      {
        id: 'note',
        label: k('note'),
        target: 'node',
        apply: (s, node) => code.addStateNote(s, node!, k('noteText'))
      }
    ],
    links: [
      {
        id: 'transition',
        label: k('transition'),
        glyph: '—>',
        hint: k('transitionHint'),
        apply: (s, from, to) => code.addTransition(s, from, to)
      }
    ],
    nameAt: byNodeId('state')
  }
}

function activityKit(): Kit {
  const node = (shape: code.ActivityShape): Piece => ({
    id: shape,
    label: k(shape),
    target: 'canvas',
    apply: (s) => code.addActivity(s, shape, k(`${shape}Base`), k(`${shape}Text`))
  })
  const flow = (kind: code.FlowKind, glyph: string): Link => ({
    id: kind,
    label: k(kind),
    glyph,
    hint: k('flowHint'),
    apply: (s, from, to) => code.addFlow(s, from, to, kind)
  })
  return {
    type: 'activity',
    pieces: [
      node('start'),
      node('action'),
      node('decision'),
      node('end'),
      node('subprocess'),
      node('data')
    ],
    links: [flow('arrow', '—>'), flow('dotted', '┄>'), flow('thick', '═>')],
    nameAt: byNodeId('activity')
  }
}

function erKit(): Kit {
  const rel = (kind: code.Cardinality, glyph: string): Link => ({
    id: kind,
    label: k(kind),
    glyph,
    hint: k('relationshipHint'),
    apply: (s, from, to) => code.addRelationship(s, from, to, kind, k('relationshipText'))
  })
  return {
    type: 'er',
    pieces: [
      {
        id: 'entity',
        label: k('entity'),
        target: 'canvas',
        apply: (s) => code.addEntity(s, k('entityBase'), `string ${k('idAttribute')}`)
      },
      {
        id: 'attribute',
        label: k('attribute'),
        target: 'node',
        apply: (s, node) =>
          code.addEntityAttribute(s, node!, `string ${code.freeName(s, k('attributeBase'))}`)
      }
    ],
    links: [
      rel('one-many', '1:n'),
      rel('one-one', '1:1'),
      rel('many-many', 'n:m'),
      rel('zero-one', '0..1')
    ],
    nameAt: byNodeId('er')
  }
}

const KITS: Record<DiagramType, () => Kit> = {
  class: classKit,
  sequence: sequenceKit,
  state: stateKit,
  activity: activityKit,
  er: erKit
}

export function kitFor(type: DiagramType): Kit {
  return KITS[type]()
}
