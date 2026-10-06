import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { dayKey } from '@shared/dates'
import { locale } from '../i18n'
import { usePresence } from '../lib/hooks'
import { adjacentDay, journalDays, parseDay } from '../lib/journal'
import { useStore } from '../store'
import { ArrowLeftIcon, ArrowRightIcon, CalendarIcon } from './Icons'

/**
 * Above a journal page: the weekday and date in words, previous/next entry, today, and a month
 * calendar that marks days with entries.
 */
export function JournalBar({ day }: { day: string }): React.JSX.Element {
  const { t } = useTranslation()
  const titles = useStore((s) => s.titles)
  const open = useStore((s) => s.calendarOpen)
  const openDay = useStore((s) => s.openJournalDay)
  const days = useMemo(() => journalDays(titles), [titles])
  const calendar = usePresence(open, 140)
  const prev = adjacentDay(days, day, -1)
  const next = adjacentDay(days, day, 1)
  const today = dayKey()
  const label = new Intl.DateTimeFormat(locale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(parseDay(day))

  return (
    <div className="journal-bar">
      <span className="journal-date">{label}</span>
      <span className="journal-nav">
        <button
          className="icon-button"
          disabled={!prev}
          title={t('journal.previous')}
          aria-label={t('journal.previous')}
          onClick={() => prev && void openDay(prev)}
        >
          <ArrowLeftIcon size={14} />
        </button>
        <button
          className="button small"
          disabled={day === today}
          onClick={() => void openDay(today)}
        >
          {t('journal.today')}
        </button>
        <button
          className="icon-button"
          disabled={!next}
          title={t('journal.next')}
          aria-label={t('journal.next')}
          onClick={() => next && void openDay(next)}
        >
          <ArrowRightIcon size={14} />
        </button>
        <button
          className="icon-button"
          aria-pressed={open}
          aria-haspopup="dialog"
          title={t('journal.calendar')}
          aria-label={t('journal.calendar')}
          onClick={() => useStore.setState({ calendarOpen: !open })}
        >
          <CalendarIcon size={14} />
        </button>
        {calendar.mounted && <Calendar day={day} days={days} closing={calendar.closing} />}
      </span>
    </div>
  )
}

function Calendar({
  day,
  days,
  closing
}: {
  day: string
  days: string[]
  closing: boolean
}): React.JSX.Element {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const openDay = useStore((s) => s.openJournalDay)
  const [month, setMonth] = useState(() => {
    const d = parseDay(day)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const has = useMemo(() => new Set(days), [days])
  const close = (): void => useStore.setState({ calendarOpen: false })

  useEffect(() => {
    const down = (e: Event): void => {
      const target = e.target as HTMLElement
      if (!ref.current?.contains(target) && !target.closest?.('.journal-nav')) close()
    }
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('keydown', key)
    }
  }, [])

  // Weeks start on Monday (de) or Sunday (en)
  const weekStart = locale().startsWith('en') ? 0 : 1
  const lead = (month.getDay() - weekStart + 7) % 7
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= count; d++)
    cells.push(dayKey(new Date(month.getFullYear(), month.getMonth(), d)))
  const weekday = new Intl.DateTimeFormat(locale(), { weekday: 'narrow' })
  const names = Array.from({ length: 7 }, (_, i) =>
    weekday.format(new Date(2024, 0, 7 + weekStart + i))
  )
  const today = dayKey()
  const shift = (n: number): void => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))

  return (
    <div
      className={`calendar glass ${closing ? 'closing' : ''}`}
      role="dialog"
      aria-label={t('journal.calendar')}
      ref={ref}
    >
      <div className="calendar-head">
        <button
          className="icon-button"
          aria-label={t('journal.prevMonth')}
          onClick={() => shift(-1)}
        >
          <ArrowLeftIcon size={13} />
        </button>
        <span>
          {new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(month)}
        </span>
        <button
          className="icon-button"
          aria-label={t('journal.nextMonth')}
          onClick={() => shift(1)}
        >
          <ArrowRightIcon size={13} />
        </button>
      </div>
      <div className="calendar-grid">
        {names.map((n, i) => (
          <span key={`h${i}`} className="calendar-weekday">
            {n}
          </span>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              className={[
                'calendar-day',
                has.has(d) && 'has-entry',
                d === day && 'current',
                d === today && 'today'
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                close()
                void openDay(d)
              }}
            >
              {Number(d.slice(8))}
            </button>
          ) : (
            <span key={`e${i}`} />
          )
        )}
      </div>
    </div>
  )
}
