import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { t } from '../i18n'
import {
  addClass,
  addMember,
  addRelation,
  classNameFromNodeId,
  freeName,
  type ClassKind,
  type MemberKind,
  type RelationKind
} from './umlCode'

/** What a palette chip carries while it is dragged. */
type Piece = { type: 'class'; kind: ClassKind } | { type: 'member'; kind: MemberKind }

const CLASSES: { kind: ClassKind; label: string; base: string }[] = [
  { kind: 'class', label: 'uml.class', base: 'uml.classBase' },
  { kind: 'interface', label: 'uml.interface', base: 'uml.interfaceBase' },
  { kind: 'abstract', label: 'uml.abstract', base: 'uml.abstractBase' },
  { kind: 'enum', label: 'uml.enum', base: 'uml.enumBase' }
]

const MEMBERS: { kind: MemberKind; label: string }[] = [
  { kind: 'attribute', label: 'uml.attribute' },
  { kind: 'method', label: 'uml.method' }
]

/** The glyphs echo the arrowheads and diamonds of UML. */
const RELATIONS: { kind: RelationKind; glyph: string }[] = [
  { kind: 'inheritance', glyph: '◁—' },
  { kind: 'realization', glyph: '◁┄' },
  { kind: 'association', glyph: '—>' },
  { kind: 'dependency', glyph: '┄>' },
  { kind: 'aggregation', glyph: '◇—' },
  { kind: 'composition', glyph: '◆—' }
]

const label = (piece: Piece): string =>
  t(
    piece.type === 'class'
      ? CLASSES.find((c) => c.kind === piece.kind)!.label
      : MEMBERS.find((m) => m.kind === piece.kind)!.label
  )

/** Rendered class node at a point of the screen, and the class it stands for. */
function classAt(x: number, y: number): { node: Element; name: string } | null {
  const node = document.elementFromPoint(x, y)?.closest('g[id*="-classId-"]')
  const name = node && classNameFromNodeId(node.id)
  return node && name ? { node, name } : null
}

/** Where a drag is now: the pointer, or for keyboard drags the middle of the moved chip. */
function dragPoint(e: DragMoveEvent | DragEndEvent): { x: number; y: number } | null {
  const start = e.activatorEvent
  if (start instanceof PointerEvent || start instanceof MouseEvent)
    return { x: start.clientX + e.delta.x, y: start.clientY + e.delta.y }
  const r = e.active.rect.current.translated
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
}

function memberCode(source: string, kind: MemberKind): string {
  return kind === 'attribute'
    ? `+${freeName(source, t('uml.attributeBase'))}: String`
    : `+${freeName(source, t('uml.methodBase'))}()`
}

/** The area pieces can be dropped on; a component of its own to sit inside the DndContext. */
function DropArea(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  const { setNodeRef } = useDroppable({ id: 'uml-stage' })
  return <div ref={setNodeRef} {...props} />
}

function Chip({ piece, onAdd }: { piece: Piece; onAdd?: () => void }): React.JSX.Element {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `${piece.type}-${piece.kind}`,
    data: piece
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`uml-chip uml-${piece.type} ${isDragging ? 'lifted' : ''}`}
      title={piece.type === 'class' ? t('uml.classHint') : t('uml.memberHint')}
      {...attributes}
      {...listeners}
      onClick={onAdd}
    >
      {label(piece)}
    </button>
  )
}

/**
 * Building a UML class diagram by hand: chips to drag into the diagram (classes) or onto a class
 * (attributes, methods), and a relation to draw by dragging from one class to another. Every
 * gesture writes the matching Mermaid line, so the code beside the diagram grows along.
 */
export function UmlStage({
  source,
  onChange,
  children
}: {
  source: string
  onChange(source: string): void
  children: React.ReactNode
}): React.JSX.Element {
  const [relation, setRelation] = useState<RelationKind>('association')
  const [lifted, setLifted] = useState<Piece | null>(null)
  const [line, setLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const connect = useRef<{ from: string; x: number; y: number; moved: boolean } | null>(null)
  const marked = useRef<Element | null>(null)
  // A few pixels of travel before a drag starts, so a click on a class chip still adds it
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  )

  // The class a gesture would land on gets a ring, so it's clear where it goes
  const mark = (node: Element | null): void => {
    if (marked.current === node) return
    marked.current?.classList.remove('uml-target')
    node?.classList.add('uml-target')
    marked.current = node
  }

  const add = (piece: Piece, at: { x: number; y: number } | null): void => {
    if (piece.type === 'class') {
      const base = t(CLASSES.find((c) => c.kind === piece.kind)!.base)
      onChange(addClass(source, piece.kind, base).source)
      return
    }
    const target = at && classAt(at.x, at.y)
    if (target) onChange(addMember(source, target.name, memberCode(source, piece.kind)))
  }

  const onDragMove = (e: DragMoveEvent): void => {
    const at = dragPoint(e)
    const piece = e.active.data.current as Piece
    mark(piece.type === 'member' && at ? (classAt(at.x, at.y)?.node ?? null) : null)
  }

  const onDragEnd = (e: DragEndEvent): void => {
    setLifted(null)
    mark(null)
    if (e.over) add(e.active.data.current as Piece, dragPoint(e))
  }

  const local = (el: HTMLElement, x: number, y: number): { x: number; y: number } => {
    const r = el.getBoundingClientRect()
    return { x: x - r.left, y: y - r.top }
  }

  const endConnect = (): void => {
    connect.current = null
    setLine(null)
    mark(null)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setLifted(e.active.data.current as Piece)}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setLifted(null)
        mark(null)
      }}
    >
      <DropArea
        className="uml-stage"
        onPointerDown={(e) => {
          const from = e.button === 0 ? classAt(e.clientX, e.clientY) : null
          if (!from) return
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          connect.current = { from: from.name, x: e.clientX, y: e.clientY, moved: false }
        }}
        onPointerMove={(e) => {
          const c = connect.current
          if (!c) return
          if (!c.moved && Math.hypot(e.clientX - c.x, e.clientY - c.y) < 5) return
          c.moved = true
          const a = local(e.currentTarget, c.x, c.y)
          const b = local(e.currentTarget, e.clientX, e.clientY)
          setLine({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
          const over = classAt(e.clientX, e.clientY)
          mark(over && over.name !== c.from ? over.node : null)
        }}
        onPointerUp={(e) => {
          const c = connect.current
          endConnect()
          const to = c?.moved ? classAt(e.clientX, e.clientY) : null
          if (c && to) onChange(addRelation(source, c.from, to.name, relation))
        }}
        onPointerCancel={endConnect}
      >
        <div className="uml-palette" role="toolbar" aria-label={t('uml.palette')}>
          <div className="uml-group">
            {CLASSES.map((c) => (
              <Chip
                key={c.kind}
                piece={{ type: 'class', kind: c.kind }}
                // Classes can also be added with a click
                onAdd={() => add({ type: 'class', kind: c.kind }, null)}
              />
            ))}
          </div>
          <div className="uml-group">
            {MEMBERS.map((m) => (
              <Chip key={m.kind} piece={{ type: 'member', kind: m.kind }} />
            ))}
          </div>
          <div className="uml-group" role="radiogroup" aria-label={t('uml.relation')}>
            {RELATIONS.map((r) => (
              <button
                key={r.kind}
                type="button"
                role="radio"
                aria-checked={relation === r.kind}
                className="uml-relation"
                title={`${t(`uml.${r.kind}`)} – ${t(`uml.${r.kind}Hint`)}`}
                aria-label={t(`uml.${r.kind}`)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setRelation(r.kind)}
              >
                {r.glyph}
              </button>
            ))}
          </div>
        </div>
        {children}
        {line && (
          <svg className="uml-connect" aria-hidden="true">
            <line {...line} />
          </svg>
        )}
      </DropArea>
      {/* In the body: the diagram block clips its content and would cut the chip off */}
      {createPortal(
        <DragOverlay dropAnimation={null} className="uml-overlay">
          {lifted && <div className={`uml-chip uml-${lifted.type}`}>{label(lifted)}</div>}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  )
}
