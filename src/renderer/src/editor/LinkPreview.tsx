import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { linkLabel, parseLinkTarget } from '@shared/wikilinks'
import { t } from '../i18n'
import { editorBridge, type PageEmbed } from './bridge'

const SHOW_DELAY = 450
const GAP = 6

/**
 * Hovering a `[[link]]` for a moment shows the start of the page it points to (or the heading
 * or block it names). Read-only and out of the pointer's way; leaving the link closes it.
 */
export function useLinkPreview(target: string): {
  bind: {
    onMouseEnter(e: React.MouseEvent<HTMLElement>): void
    onMouseLeave(): void
  }
  close(): void
  preview: React.ReactNode
} {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const close = (): void => {
    clearTimeout(timer.current)
    setAnchor(null)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  // Anything that moves the page or the caret makes the preview stale
  useEffect(() => {
    if (!anchor) return
    const off = (): void => setAnchor(null)
    window.addEventListener('scroll', off, { capture: true, passive: true })
    window.addEventListener('keydown', off, { capture: true })
    window.addEventListener('blur', off)
    return () => {
      window.removeEventListener('scroll', off, { capture: true })
      window.removeEventListener('keydown', off, { capture: true })
      window.removeEventListener('blur', off)
    }
  }, [anchor])

  return {
    bind: {
      onMouseEnter: (e) => {
        const el = e.currentTarget
        clearTimeout(timer.current)
        // Not while selecting text or dragging across the link
        if (e.buttons) return
        timer.current = setTimeout(() => {
          if (el.isConnected) setAnchor(el.getBoundingClientRect())
        }, SHOW_DELAY)
      },
      onMouseLeave: close
    },
    close,
    preview: anchor
      ? createPortal(<Preview target={target} anchor={anchor} />, document.body)
      : null
  }
}

function Preview({ target, anchor }: { target: string; anchor: DOMRect }): React.JSX.Element {
  const exists = editorBridge.useTitleExists(target)
  const [page, setPage] = useState<PageEmbed | null | undefined>(undefined)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    if (!exists) return
    let live = true
    void editorBridge.loadPage(target).then((p) => live && setPage(p))
    return () => {
      live = false
    }
  }, [target, exists])

  // Below the link, or above it when there is no room; never past the window edges
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const below = anchor.bottom + GAP
    const top =
      below + height > window.innerHeight - 8 && anchor.top - GAP - height > 8
        ? anchor.top - GAP - height
        : below
    const left = Math.min(Math.max(8, anchor.left), window.innerWidth - width - 8)
    setPos({ left, top })
  }, [anchor, page])

  const heading = parseLinkTarget(target).heading
  return (
    <div
      ref={ref}
      className="link-preview popover glass"
      role="tooltip"
      style={pos ? { left: pos.left, top: pos.top } : { left: anchor.left, top: anchor.bottom }}
    >
      {!exists ? (
        <div className="link-preview-empty">{t('editor.missingPage')}</div>
      ) : (
        <>
          <div className="link-preview-title">
            {page?.title ?? linkLabel(target)}
            {heading ? ` › ${heading}` : ''}
          </div>
          {page === null ? (
            <div className="link-preview-empty">{t('editor.embedMissing', { target })}</div>
          ) : (
            <div className="link-preview-text">
              {page?.text || (page ? t('editor.previewEmpty') : '')}
            </div>
          )}
          <div className="link-preview-hint">{t('editor.previewHint')}</div>
        </>
      )}
    </div>
  )
}
