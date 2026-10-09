import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../store'
import { CloseIcon } from './Icons'

/** Headings of the open page; click to jump, the section in view is highlighted. */
export function Outline({ closing }: { closing: boolean }): React.JSX.Element | null {
  const { t } = useTranslation()
  // The outline sits in the main pane and lists its page
  const editor = useStore((s) => s.editors.main)
  const docVersion = useStore((s) => s.docVersion)
  const toggle = useStore((s) => s.toggleOutline)
  const [active, setActive] = useState<string | null>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const headings = useMemo(() => editor?.headings() ?? [], [editor, docVersion])
  const min = Math.min(...headings.map((h) => h.level), 6)

  useEffect(() => {
    const scroller = document.querySelector('.main-scroll')
    if (!scroller || !headings.length) return
    const update = (): void => {
      let current: string | null = headings[0]?.id ?? null
      for (const h of headings) {
        const el = document.querySelector(`.write-editor [data-id="${CSS.escape(h.id)}"]`)
        if (el && el.getBoundingClientRect().top < 140) current = h.id
      }
      setActive(current)
    }
    update()
    scroller.addEventListener('scroll', update, { passive: true })
    return () => scroller.removeEventListener('scroll', update)
  }, [headings])

  if (!editor) return null
  return (
    <nav className={`outline ${closing ? 'closing' : ''}`} aria-label={t('outline.title')}>
      <div className="outline-head">
        <span>{t('outline.title')}</span>
        <button
          className="icon-button"
          aria-label={t('common.close')}
          title={t('common.close')}
          onClick={toggle}
        >
          <CloseIcon size={12} />
        </button>
      </div>
      {headings.length === 0 && <p className="outline-empty">{t('outline.empty')}</p>}
      {headings.map((h) => (
        <button
          key={h.id}
          className={`outline-item ${active === h.id ? 'active' : ''}`}
          style={{ paddingLeft: 8 + (h.level - min) * 12 }}
          onClick={() => editor.scrollToBlock(h.id)}
        >
          {h.text || '—'}
        </button>
      ))}
    </nav>
  )
}
