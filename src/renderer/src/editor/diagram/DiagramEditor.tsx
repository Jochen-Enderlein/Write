import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
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
  type DragMoveEvent
} from '@dnd-kit/core'
import {
  ExitFullscreenIcon,
  FitIcon,
  FullscreenIcon,
  MinusIcon,
  PlusIcon,
  RedoIcon,
  UndoIcon
} from '../../components/Icons'
import { fitView, zoomAt, type Size, type ZoomView } from '../../lib/zoom'
import { editForKey } from '../codeIndent'
import { naturalSize } from '../DiagramViewer'
import { renderMermaid } from '../mermaid'
import { DIAGRAM_TYPES, diagramType, startDiagram, type DiagramType } from './code'
import { record, redo, startHistory, undo, type History } from './history'
import { kitFor, type Kit, type Piece } from './kits'

const STEP = 1.25
const TYPE_KEY: Record<DiagramType, string> = {
  class: 'Class',
  sequence: 'Sequence',
  state: 'State',
  activity: 'Activity',
  er: 'Er'
}

/** Where a drag is now: the pointer, or for keyboard drags the middle of the moved chip. */
function dragPoint(e: DragMoveEvent | DragEndEvent): { x: number; y: number } | null {
  const start = e.activatorEvent
  if (start instanceof PointerEvent || start instanceof MouseEvent)
    return { x: start.clientX + e.delta.x, y: start.clientY + e.delta.y }
  const r = e.active.rect.current.translated
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
}

/** The diagram element under a point, with the name the code knows it by. */
function elementAt(kit: Kit, x: number, y: number): { node: Element; name: string } | null {
  const el = document.elementFromPoint(x, y)
  const root = el?.closest('.de-stage')?.querySelector('.de-content')
  if (!el || !root) return null
  const name = root.contains(el) ? kit.nameAt(el) : null
  const node = el.closest('g.node, [name]')
  if (name && node) return { node, name }
  return kit.nearest?.(root, x, y) ?? null
}

function Chip({ piece, onAdd }: { piece: Piece; onAdd(): void }): React.JSX.Element {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: piece.id,
    data: piece
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`de-chip ${piece.target === 'node' ? 'on-node' : ''} ${isDragging ? 'lifted' : ''}`}
      {...attributes}
      {...listeners}
      // Pieces for the canvas can also be added with a click
      onClick={piece.target === 'canvas' ? onAdd : undefined}
    >
      {piece.label}
    </button>
  )
}

function Canvas(props: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  const { setNodeRef } = useDroppable({ id: 'diagram-canvas' })
  return <div ref={setNodeRef} {...props} />
}

/**
 * A diagram across the whole window, to build by hand: building blocks on the left go into the
 * diagram or onto its elements, connections are drawn from element to element, and the Mermaid
 * code on the right grows along (and can be edited there, the drawing follows).
 */
export function DiagramEditor({
  source,
  onChange,
  onClose
}: {
  source: string
  onChange(source: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [history, setHistory] = useState<History>(() => startHistory(source))
  const code = history.present
  const type = diagramType(code)
  const kit = useMemo(() => (type ? kitFor(type) : null), [type])
  const [linkId, setLinkId] = useState<Record<string, string>>({})
  const link = kit ? (kit.links.find((l) => l.id === linkId[kit.type]) ?? kit.links[0]) : null

  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const [size, setSize] = useState<Size | null>(null)
  const [view, setView] = useState<ZoomView>({ scale: 1, x: 0, y: 0 })
  const [glide, setGlide] = useState(false)
  const [full, setFull] = useState(false)
  const [lifted, setLifted] = useState<Piece | null>(null)
  const [line, setLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  // While fitted, the diagram stays fitted as it grows and as the window changes
  const fitted = useRef(true)
  const gesture = useRef<
    | { kind: 'pan'; x: number; y: number; view: ZoomView }
    | { kind: 'link'; from: string; x: number; y: number; moved: boolean }
    | null
  >(null)
  const marked = useRef<Element | null>(null)
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click still adds a piece
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  )

  const change = (next: string, typing = false): void => {
    setHistory((h) => record(h, next, typing, Date.now()))
    onChange(next)
  }
  const step = (move: (h: History) => History): void => {
    const next = move(history)
    if (next === history) return
    setHistory(next)
    onChange(next.present)
  }

  // The drawing follows the code; a half-written line keeps the last good drawing
  useEffect(() => {
    let stale = false
    const id = setTimeout(() => {
      if (!code.trim()) {
        setSvg('')
        setError('')
        return
      }
      void renderMermaid(code).then((res) => {
        if (stale) return
        if ('svg' in res) {
          setSvg(res.svg)
          setError('')
        } else setError(res.error)
      })
    }, 200)
    return () => {
      stale = true
      clearTimeout(id)
    }
  }, [code])

  useLayoutEffect(() => {
    const el = content.current?.querySelector('svg')
    if (!el) return setSize(null)
    const natural = naturalSize(el)
    el.setAttribute('width', String(natural.width))
    el.setAttribute('height', String(natural.height))
    el.style.maxWidth = 'none'
    setSize(natural)
  }, [svg])

  const fit = useCallback(
    (animated: boolean) => {
      const el = stage.current
      if (!size || !el) return
      fitted.current = true
      setGlide(animated)
      // Not as large as the viewer would: while building, the diagram should keep its size
      setView(fitView(size, { width: el.clientWidth, height: el.clientHeight }, 48, 1.5))
    },
    [size]
  )

  useLayoutEffect(() => {
    if (fitted.current) fit(false)
  }, [fit])

  useEffect(() => {
    const el = stage.current
    if (!el) return
    const observer = new ResizeObserver(() => fitted.current && fit(false))
    observer.observe(el)
    return () => observer.disconnect()
  }, [fit])

  // Pinching arrives as wheel events with ctrlKey; plain scrolling moves the canvas. Native, as
  // React's wheel listener is passive and can't keep the page from zooming.
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      fitted.current = false
      setGlide(false)
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect()
        const at = { x: e.clientX - r.left, y: e.clientY - r.top }
        setView((v) => zoomAt(v, Math.exp(-e.deltaY * 0.01), at))
      } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const zoom = (factor: number): void => {
    const el = stage.current
    if (!el) return
    fitted.current = false
    setGlide(true)
    setView((v) => zoomAt(v, factor, { x: el.clientWidth / 2, y: el.clientHeight / 2 }))
  }

  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void root.current?.requestFullscreen().catch(() => undefined)
  }

  useEffect(() => {
    const onChange = (): void => setFull(document.fullscreenElement === root.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    root.current?.focus()
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen()
      before?.focus({ preventScroll: true })
    }
  }, [])

  // The element a gesture would land on gets a glow, so it's clear where it goes
  const mark = (node: Element | null): void => {
    if (marked.current === node) return
    marked.current?.classList.remove('de-target')
    node?.classList.add('de-target')
    marked.current = node
  }

  const addPiece = (piece: Piece, at: { x: number; y: number } | null): void => {
    if (!kit) return
    if (piece.target === 'canvas') return change(piece.apply(code))
    const target = at && elementAt(kit, at.x, at.y)
    if (target) change(piece.apply(code, target.name))
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const inCode = e.target === field.current
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (document.fullscreenElement) void document.exitFullscreen()
      else onClose()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      e.stopPropagation()
      step(e.shiftKey ? redo : undo)
      return
    }
    if (inCode || e.metaKey || e.ctrlKey || e.altKey) return
    const keys: Record<string, () => void> = {
      '+': () => zoom(STEP),
      '=': () => zoom(STEP),
      '-': () => zoom(1 / STEP),
      '0': () => fit(true),
      f: toggleFullscreen
    }
    const run = keys[e.key]
    if (!run) return
    e.preventDefault()
    e.stopPropagation()
    run()
  }

  const local = (x: number, y: number): { x: number; y: number } => {
    const r = stage.current!.getBoundingClientRect()
    return { x: x - r.left, y: y - r.top }
  }

  const endGesture = (): void => {
    gesture.current = null
    setLine(null)
    mark(null)
  }

  const typeLabel = (ty: DiagramType): string => t(`diagramEditor.type${TYPE_KEY[ty]}`)

  return createPortal(
    <div
      ref={root}
      className="diagram-editor"
      role="dialog"
      aria-modal="true"
      aria-label={t('diagramEditor.title')}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setLifted(e.active.data.current as Piece)}
        onDragMove={(e) => {
          const piece = e.active.data.current as Piece
          const at = dragPoint(e)
          mark(
            kit && piece.target === 'node' && at ? (elementAt(kit, at.x, at.y)?.node ?? null) : null
          )
        }}
        onDragEnd={(e) => {
          setLifted(null)
          mark(null)
          if (e.over) addPiece(e.active.data.current as Piece, dragPoint(e))
        }}
        onDragCancel={() => {
          setLifted(null)
          mark(null)
        }}
      >
        <header className="de-bar">
          <div className="de-title">
            {t('diagramEditor.title')}
            {type && <span className="de-type">{typeLabel(type)}</span>}
          </div>
          <div className="de-actions">
            <button
              className="icon-button"
              title={`${t('diagramEditor.undo')} ⌘Z`}
              aria-label={t('diagramEditor.undo')}
              disabled={!history.past.length}
              onClick={() => step(undo)}
            >
              <UndoIcon />
            </button>
            <button
              className="icon-button"
              title={`${t('diagramEditor.redo')} ⇧⌘Z`}
              aria-label={t('diagramEditor.redo')}
              disabled={!history.future.length}
              onClick={() => step(redo)}
            >
              <RedoIcon />
            </button>
            <span className="de-sep" />
            <button
              className="icon-button"
              title={`${t('diagram.zoomOut')} −`}
              aria-label={t('diagram.zoomOut')}
              onClick={() => zoom(1 / STEP)}
            >
              <MinusIcon />
            </button>
            <span className="diagram-scale" aria-live="polite">
              {Math.round(view.scale * 100)} %
            </span>
            <button
              className="icon-button"
              title={`${t('diagram.zoomIn')} +`}
              aria-label={t('diagram.zoomIn')}
              onClick={() => zoom(STEP)}
            >
              <PlusIcon />
            </button>
            <button
              className="icon-button"
              title={`${t('diagram.fit')} 0`}
              aria-label={t('diagram.fit')}
              onClick={() => fit(true)}
            >
              <FitIcon />
            </button>
            <button
              className="icon-button"
              title={`${full ? t('diagram.exitFullscreen') : t('diagram.fullscreen')} F`}
              aria-label={full ? t('diagram.exitFullscreen') : t('diagram.fullscreen')}
              aria-pressed={full}
              onClick={toggleFullscreen}
            >
              {full ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
            <button className="button primary" onClick={onClose}>
              {t('diagramEditor.done')}
            </button>
          </div>
        </header>

        <div className="de-body">
          <aside className="de-palette" aria-label={t('diagramEditor.elements')}>
            {kit ? (
              <>
                <section>
                  <h3>{t('diagramEditor.elements')}</h3>
                  <div className="de-chips">
                    {kit.pieces
                      .filter((p) => p.target === 'canvas')
                      .map((p) => (
                        <Chip key={p.id} piece={p} onAdd={() => addPiece(p, null)} />
                      ))}
                  </div>
                </section>
                {kit.pieces.some((p) => p.target === 'node') && (
                  <section>
                    <h3>{t('diagramEditor.onElement')}</h3>
                    <div className="de-chips">
                      {kit.pieces
                        .filter((p) => p.target === 'node')
                        .map((p) => (
                          <Chip key={p.id} piece={p} onAdd={() => undefined} />
                        ))}
                    </div>
                  </section>
                )}
                <section>
                  <h3>{t('diagramEditor.links')}</h3>
                  <p className="de-hint">{t('diagramEditor.linksHint')}</p>
                  <div className="de-links" role="radiogroup" aria-label={t('diagramEditor.links')}>
                    {kit.links.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        role="radio"
                        aria-checked={link?.id === l.id}
                        className="de-link"
                        title={`${l.label} – ${l.hint}`}
                        onClick={() => setLinkId((m) => ({ ...m, [kit.type]: l.id }))}
                      >
                        <span className="glyph" aria-hidden="true">
                          {l.glyph}
                        </span>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            ) : code.trim() ? (
              <p className="de-hint">{t('diagramEditor.noKit')}</p>
            ) : null}
          </aside>

          <Canvas className="de-canvas" aria-label={t('diagramEditor.canvasHint')}>
            <div
              ref={stage}
              className="de-stage"
              onPointerDown={(e) => {
                if (e.button !== 0 || !svg) return
                const from = kit && link ? elementAt(kit, e.clientX, e.clientY) : null
                e.currentTarget.setPointerCapture(e.pointerId)
                gesture.current = from
                  ? { kind: 'link', from: from.name, x: e.clientX, y: e.clientY, moved: false }
                  : { kind: 'pan', x: e.clientX, y: e.clientY, view }
                setGlide(false)
              }}
              onPointerMove={(e) => {
                const g = gesture.current
                if (!g) return
                if (g.kind === 'pan') {
                  fitted.current = false
                  setView({
                    ...g.view,
                    x: g.view.x + e.clientX - g.x,
                    y: g.view.y + e.clientY - g.y
                  })
                  return
                }
                if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 5) return
                g.moved = true
                const a = local(g.x, g.y)
                const b = local(e.clientX, e.clientY)
                setLine({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
                // Sequence messages may go to the sender itself; elsewhere only to another one
                const over = kit && elementAt(kit, e.clientX, e.clientY)
                mark(over && (over.name !== g.from || kit.type === 'sequence') ? over.node : null)
              }}
              onPointerUp={(e) => {
                const g = gesture.current
                endGesture()
                if (g?.kind !== 'link' || !g.moved || !kit || !link) return
                const to = elementAt(kit, e.clientX, e.clientY)
                if (to) change(link.apply(code, g.from, to.name))
              }}
              onPointerCancel={endGesture}
            >
              {type || code.trim() ? (
                <div
                  ref={content}
                  className={`de-content ${glide ? 'glide' : ''}`}
                  style={{
                    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                    visibility: size ? undefined : 'hidden'
                  }}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              ) : (
                <div className="de-picker">
                  <h2>{t('diagramEditor.pick')}</h2>
                  <div className="de-types">
                    {DIAGRAM_TYPES.map((ty) => (
                      <button
                        key={ty}
                        type="button"
                        className="de-type-card"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => change(startDiagram(code, ty))}
                      >
                        <strong>{typeLabel(ty)}</strong>
                        <span>{t(`diagramEditor.type${TYPE_KEY[ty]}Hint`)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {line && (
                <svg className="de-connect" aria-hidden="true">
                  <line {...line} />
                </svg>
              )}
            </div>
            {error && <div className="de-error">{error}</div>}
          </Canvas>

          <section className="de-code">
            <label className="de-code-label" htmlFor="diagram-editor-code">
              {t('diagramEditor.code')}
            </label>
            <textarea
              id="diagram-editor-code"
              ref={field}
              className="de-input"
              value={code}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              onChange={(e) => change(e.target.value, true)}
              onKeyDown={(e) => {
                const key =
                  e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey
                    ? 'Enter'
                    : e.key === 'Tab'
                      ? e.shiftKey
                        ? 'Shift-Tab'
                        : 'Tab'
                      : null
                if (!key) return
                const el = e.currentTarget
                const edit = editForKey(key, el.value, el.selectionStart, el.selectionEnd)
                if (!edit) return
                e.preventDefault()
                change(edit.text, true)
                requestAnimationFrame(() => el.setSelectionRange(edit.start, edit.end))
              }}
            />
          </section>
        </div>

        <DragOverlay dropAnimation={null} className="de-overlay">
          {lifted && <div className="de-chip">{lifted.label}</div>}
        </DragOverlay>
      </DndContext>
    </div>,
    document.body
  )
}
