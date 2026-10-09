import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PaneContext } from '../lib/pane'
import { useStore } from '../store'
import { ErrorBoundary } from './ErrorBoundary'
import { FindBar } from './FindBar'
import { ArrowLeftIcon, CloseIcon } from './Icons'
import { PageView, type SaveStatus } from './PageView'

const WIDTH_KEY = 'side:width'
const MIN_WIDTH = 300
/** Room the main pane keeps when the divider is dragged right to left. */
const MAIN_MIN = 360

/**
 * Split view: a second page to the right of the main view. It edits like the main page; the
 * toolbar, outline and history stay with the main page, links clicked here open here.
 */
export function SidePane({ path }: { path: string }): React.JSX.Element {
  const { t } = useTranslation()
  const active = useStore((s) => s.activePane === 'side')
  const title = useStore((s) => s.titleIndex.get(path)?.title ?? titleFromPath(path))
  const icon = useStore((s) => s.titleIndex.get(path)?.icon)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [scrolled, setScrolled] = useState(false)
  // Null splits the room evenly; dragging the divider fixes a width
  const [width, setWidth] = useState<number | null>(readWidth)
  const section = useRef<HTMLElement>(null)
  const s = useStore.getState

  const onDividerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    const el = section.current
    if (!el) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const right = el.getBoundingClientRect().right
    const left = el.parentElement?.querySelector('.main')?.getBoundingClientRect().left ?? 0
    const clamp = (w: number): number =>
      Math.round(Math.max(MIN_WIDTH, Math.min(right - left - MAIN_MIN, w)))
    let next = el.getBoundingClientRect().width
    const target = e.currentTarget
    const move = (ev: PointerEvent): void => {
      next = clamp(right - ev.clientX)
      setWidth(next)
    }
    const up = (): void => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      writeWidth(next)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }

  return (
    <PaneContext.Provider value="side">
      <section
        ref={section}
        className={['side-pane', active && 'active', scrolled && 'scrolled']
          .filter(Boolean)
          .join(' ')}
        style={width ? { flex: `0 0 ${width}px` } : undefined}
        aria-label={t('split.label')}
        onPointerDownCapture={() => s().setActivePane('side')}
        onFocusCapture={() => s().setActivePane('side')}
      >
        <div
          className="side-divider"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={onDividerDown}
          onDoubleClick={() => {
            setWidth(null)
            writeWidth(null)
          }}
        />
        <header className="side-toolbar">
          <span className="side-title" title={title}>
            {icon ? `${icon} ` : ''}
            {title}
          </span>
          <span
            className={`save-dot ${status === 'saving' || status === 'dirty' ? 'pending' : ''}`}
            aria-hidden="true"
          />
          <div className="spacer" />
          <button
            className="icon-button"
            title={t('split.toMain')}
            onClick={() => {
              s().closeSide()
              s().openPage(path, 'main')
            }}
          >
            <ArrowLeftIcon />
          </button>
          <button
            className="icon-button"
            title={t('split.close')}
            aria-label={t('split.close')}
            onClick={() => s().closeSide()}
          >
            <CloseIcon />
          </button>
        </header>
        <div
          className="side-scroll pane-scroll"
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
        >
          <ErrorBoundary resetKey={path}>
            <PageView path={path} onStatus={setStatus} />
          </ErrorBoundary>
        </div>
        {active && <FindBar />}
      </section>
    </PaneContext.Provider>
  )
}

function titleFromPath(path: string): string {
  return path.split('/').pop()!.replace(/\.md$/i, '')
}

function readWidth(): number | null {
  try {
    const w = Number(localStorage.getItem(WIDTH_KEY))
    return w >= MIN_WIDTH ? w : null
  } catch {
    return null
  }
}

function writeWidth(w: number | null): void {
  try {
    if (w) localStorage.setItem(WIDTH_KEY, String(w))
    else localStorage.removeItem(WIDTH_KEY)
  } catch {
    // per-viewer convenience only
  }
}
