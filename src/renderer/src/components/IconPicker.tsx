import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePresence } from '../lib/hooks'
import { useStore } from '../store'
import { SmileIcon } from './Icons'

const EMOJI = [
  '📄',
  '📝',
  '📌',
  '📎',
  '📚',
  '📖',
  '🗂️',
  '🗃️',
  '📁',
  '📦',
  '🧾',
  '🗒️',
  '✅',
  '☑️',
  '⭐️',
  '🔥',
  '💡',
  '🎯',
  '🚀',
  '⚡️',
  '🔔',
  '🔒',
  '🔑',
  '🧭',
  '🏠',
  '🏢',
  '🏫',
  '🌍',
  '✈️',
  '🚗',
  '🚲',
  '⛺️',
  '🏖️',
  '🗺️',
  '📍',
  '🧳',
  '💼',
  '💰',
  '📈',
  '📊',
  '🧮',
  '🛒',
  '🧑‍💻',
  '💻',
  '🖥️',
  '📱',
  '⌚️',
  '🎧',
  '🛠️',
  '⚙️',
  '🧪',
  '🔬',
  '🧠',
  '❤️',
  '🩺',
  '💊',
  '🏃',
  '🧘',
  '🍎',
  '☕️',
  '🍳',
  '🍕',
  '🎂',
  '🎉',
  '🎁',
  '🎨',
  '🎵',
  '🎬',
  '📷',
  '🎮',
  '⚽️',
  '🌱',
  '🌳',
  '🌸',
  '☀️',
  '🌙',
  '⛅️',
  '❄️',
  '🌊',
  '🐶',
  '🐱',
  '🦊',
  '🐝',
  '🦋',
  '👋',
  '👍',
  '🙏',
  '🤝',
  '👥',
  '👤',
  '💬',
  '📣',
  '✉️',
  '📅',
  '⏰',
  '⏳'
]

/**
 * Page icon above the title: shows the icon (click to change) or, on hover, an "Add icon"
 * button. The icon is stored as `icon:` in the frontmatter.
 */
export function IconPicker({
  icon,
  onChange
}: {
  icon: string | null
  onChange(icon: string | null): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const token = useStore((s) => s.iconPickerToken)
  const firstToken = useRef(token)
  const { mounted, closing } = usePresence(open, 140)
  const grid = useRef<HTMLDivElement>(null)

  /** Arrow keys move through the grid like in the system emoji picker. */
  const onGridKey = (e: React.KeyboardEvent): void => {
    const buttons = [...(grid.current?.querySelectorAll('button') ?? [])]
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const cols = 12
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key]
    if (step === undefined) return
    e.preventDefault()
    if (i === -1) return buttons[0]?.focus()
    if (e.key === 'ArrowUp' && i < cols) {
      grid.current?.parentElement?.querySelector('input')?.focus()
      return
    }
    buttons[Math.max(0, Math.min(buttons.length - 1, i + step))]?.focus()
  }

  useEffect(() => {
    if (token !== firstToken.current) setOpen(true)
  }, [token])

  useEffect(() => {
    if (!open) return
    const close = (e: Event): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', key)
    }
  }, [open])

  const pick = (value: string | null): void => {
    onChange(value)
    setOpen(false)
    setCustom('')
  }

  return (
    <div className={`page-icon-area ${icon ? 'has-icon' : ''}`} ref={ref}>
      {icon ? (
        <button
          className="page-icon"
          title={t('icon.title')}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
        >
          {icon}
        </button>
      ) : (
        <button className="page-add-icon" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <SmileIcon size={14} />
          {t('page.addIcon')}
        </button>
      )}
      {mounted && (
        <div
          className={`icon-picker glass ${closing ? 'closing' : ''}`}
          role="dialog"
          aria-label={t('icon.title')}
        >
          <div className="icon-picker-head">
            <input
              autoFocus
              value={custom}
              placeholder={t('icon.search')}
              aria-label={t('icon.custom')}
              maxLength={16}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && custom.trim()) pick(custom.trim())
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  grid.current?.querySelector('button')?.focus()
                }
              }}
            />
            {icon && (
              <button className="button small" onClick={() => pick(null)}>
                {t('icon.remove')}
              </button>
            )}
          </div>
          <div className="icon-grid" ref={grid} onKeyDown={onGridKey}>
            {EMOJI.map((e) => (
              <button
                key={e}
                className={e === icon ? 'active' : ''}
                aria-label={e}
                onClick={() => pick(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
