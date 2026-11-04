import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  CloseIcon,
  ExitFullscreenIcon,
  FitIcon,
  FullscreenIcon,
  MinusIcon,
  PlusIcon
} from '../components/Icons'
import { fitView, zoomAt, type Size, type ZoomView } from '../lib/zoom'

const STEP = 1.25

/** Natural size of a rendered diagram, from its viewBox; Mermaid only sets a max-width. */
function naturalSize(svg: SVGSVGElement): Size {
  const box = svg.viewBox.baseVal
  if (box && box.width > 0 && box.height > 0) return { width: box.width, height: box.height }
  const r = svg.getBoundingClientRect()
  return { width: r.width, height: r.height }
}

/**
 * A diagram on its own across the whole window: fitted at first, then zoomed with pinch,
 * ⌘-scroll, the buttons or + and −, and moved by dragging or scrolling. Full screen on request.
 */
export function DiagramViewer({
  svg,
  onClose
}: {
  svg: string
  onClose(): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size | null>(null)
  const [view, setView] = useState<ZoomView>({ scale: 1, x: 0, y: 0 })
  // Button and key zooms glide; pinching and dragging follow the hand directly
  const [glide, setGlide] = useState(false)
  const [full, setFull] = useState(false)
  // While the diagram is fitted, it stays fitted when the window or full screen changes
  const fitted = useRef(true)
  const drag = useRef<{ x: number; y: number; view: ZoomView } | null>(null)
  const [dragging, setDragging] = useState(false)

  useLayoutEffect(() => {
    const el = content.current?.querySelector('svg')
    if (!el) return
    const natural = naturalSize(el)
    el.setAttribute('width', String(natural.width))
    el.setAttribute('height', String(natural.height))
    el.style.maxWidth = 'none'
    setSize(natural)
  }, [svg])

  const box = (): DOMRect => stage.current!.getBoundingClientRect()

  const fit = useCallback(
    (animated: boolean) => {
      if (!size || !stage.current) return
      fitted.current = true
      setGlide(animated)
      // Layout size, not the on-screen rect: the opening animation scales the viewer briefly
      const el = stage.current
      setView(fitView(size, { width: el.clientWidth, height: el.clientHeight }))
    },
    [size]
  )

  useLayoutEffect(() => fit(false), [fit])

  useEffect(() => {
    const el = stage.current
    if (!el) return
    const observer = new ResizeObserver(() => fitted.current && fit(false))
    observer.observe(el)
    return () => observer.disconnect()
  }, [fit])

  const zoom = (factor: number, point?: { x: number; y: number }, animated = true): void => {
    const r = box()
    const at = point ?? { x: r.width / 2, y: r.height / 2 }
    fitted.current = false
    setGlide(animated)
    setView((v) => zoomAt(v, factor, at))
  }

  const pan = (dx: number, dy: number, animated: boolean): void => {
    fitted.current = false
    setGlide(animated)
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
  }

  // Pinching on the trackpad arrives as wheel events with ctrlKey; plain scrolling moves. A
  // native listener, because React's wheel listener is passive and can't stop page zoom.
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

  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void root.current?.requestFullscreen().catch(() => undefined)
  }

  useEffect(() => {
    const onChange = (): void => setFull(document.fullscreenElement === root.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Take the focus for the keys, and hand it back to where it was on closing
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    root.current?.focus()
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen()
      before?.focus({ preventScroll: true })
    }
  }, [])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const keys: Record<string, () => void> = {
      // As everywhere on the Mac, Escape leaves full screen first
      Escape: () => (document.fullscreenElement ? void document.exitFullscreen() : onClose()),
      '+': () => zoom(STEP),
      '=': () => zoom(STEP),
      '-': () => zoom(1 / STEP),
      '0': () => fit(true),
      f: toggleFullscreen,
      ArrowLeft: () => pan(60, 0, true),
      ArrowRight: () => pan(-60, 0, true),
      ArrowUp: () => pan(0, 60, true),
      ArrowDown: () => pan(0, -60, true)
    }
    const run = keys[e.key]
    if (!run) return
    e.preventDefault()
    e.stopPropagation()
    run()
  }

  return createPortal(
    <div
      ref={root}
      className="diagram-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={t('diagram.viewer')}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div
        ref={stage}
        className={`diagram-stage ${dragging ? 'dragging' : ''}`}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { x: e.clientX, y: e.clientY, view }
          setDragging(true)
          setGlide(false)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          fitted.current = false
          setView({ ...d.view, x: d.view.x + e.clientX - d.x, y: d.view.y + e.clientY - d.y })
        }}
        onPointerUp={() => {
          drag.current = null
          setDragging(false)
        }}
        onPointerCancel={() => {
          drag.current = null
          setDragging(false)
        }}
        onDoubleClick={(e) => {
          // Back to the whole diagram, or a closer look at the spot clicked
          if (!fitted.current) return fit(true)
          const r = box()
          zoom(2, { x: e.clientX - r.left, y: e.clientY - r.top })
        }}
      >
        <div
          ref={content}
          className={`diagram-content ${glide ? 'glide' : ''}`}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            visibility: size ? undefined : 'hidden'
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <div className="diagram-controls glass" onPointerDown={(e) => e.stopPropagation()}>
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
        <button
          className="icon-button"
          title={`${t('diagram.close')} esc`}
          aria-label={t('diagram.close')}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>
    </div>,
    document.body
  )
}
