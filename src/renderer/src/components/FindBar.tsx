import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Match } from '../editor/find'
import { usePresence } from '../lib/hooks'
import { useStore } from '../store'
import { ArrowRightIcon, ChevronDownIcon, ChevronUpIcon, CloseIcon } from './Icons'

/** Find and replace inside the open page (⌘F, ⌥⌘F, ⌘G / ⇧⌘G). */
export function FindBar(): React.JSX.Element | null {
  const find = useStore((s) => s.find)
  const editor = useStore((s) => s.editor)
  // Leaves the way it came: back into the toolbar corner
  const { mounted, closing } = usePresence(find.open && Boolean(editor), 140)
  if (!mounted || !editor) return null
  return <FindBarBody key={editor.path} closing={closing} />
}

function FindBarBody({ closing }: { closing: boolean }): React.JSX.Element {
  const { t } = useTranslation()
  const find = useStore((s) => s.find)
  const editor = useStore((s) => s.editor)
  const docVersion = useStore((s) => s.docVersion)
  const closeFind = useStore((s) => s.closeFind)
  const notify = useStore((s) => s.notify)
  const [query, setQuery] = useState(() => {
    const pending = useStore.getState().pendingFind
    if (pending) useStore.setState({ pendingFind: null })
    return pending ?? window.getSelection()?.toString().split('\n')[0]?.slice(0, 200) ?? ''
  })
  const [replacement, setReplacement] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [showReplace, setShowReplace] = useState(find.replace)
  const [matches, setMatches] = useState<Match[]>([])
  const [current, setCurrent] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const lastStep = useRef(find.step)

  const view = useCallback(() => editor?.findTarget() ?? null, [editor])

  // Search again whenever the query or the document changes
  useEffect(() => {
    const v = view()
    if (!v) return
    const found = v.find(query, matchCase)
    setMatches(found)
    setCurrent((c) => Math.min(c, Math.max(0, found.length - 1)))
  }, [query, matchCase, docVersion, view])

  useEffect(() => {
    const v = view()
    if (closing) v?.clear()
    else if (v) v.highlight(matches, current)
  }, [matches, current, view, closing])

  useEffect(() => () => view()?.clear(), [view])

  // Focus the field whenever ⌘F is pressed again
  useLayoutEffect(() => {
    input.current?.focus()
    input.current?.select()
    if (find.replace) setShowReplace(true)
  }, [find.token, find.replace])

  const go = useCallback(
    (dir: 1 | -1) => {
      if (!matches.length) return
      const next = (current + dir + matches.length) % matches.length
      setCurrent(next)
      const v = view()
      if (v) v.reveal(matches[next])
    },
    [matches, current, view]
  )

  // ⌘G / ⇧⌘G from the menu
  useEffect(() => {
    const d = find.step - lastStep.current
    lastStep.current = find.step
    if (d) go(d > 0 ? 1 : -1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find.step])

  // First match comes into view as you type
  useEffect(() => {
    const v = view()
    if (v && matches[current]) v.reveal(matches[current])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, matchCase])

  const close = (select: boolean): void => {
    const v = view()
    if (select && v) v.select(matches[current])
    v?.clear()
    closeFind()
  }

  const replaceOne = (): void => {
    const v = view()
    const m = matches[current]
    if (!v || !m) return
    v.replace(m, replacement)
  }

  const replaceEvery = (): void => {
    const v = view()
    if (!v) return
    const n = v.replaceAll(matches, replacement)
    if (n) notify(t('find.replaced', { count: n }))
  }

  return (
    <div
      className={`find-bar glass ${closing ? 'closing' : ''}`}
      role="search"
      aria-label={t('find.placeholder')}
    >
      <div className="find-row">
        <button
          className="icon-button find-toggle"
          aria-expanded={showReplace}
          title={t('find.toggleReplace')}
          aria-label={t('find.toggleReplace')}
          onClick={() => setShowReplace((v) => !v)}
        >
          <ArrowRightIcon size={12} style={{ transform: showReplace ? 'rotate(90deg)' : '' }} />
        </button>
        <input
          ref={input}
          className="find-input"
          value={query}
          placeholder={t('find.placeholder')}
          aria-label={t('find.placeholder')}
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              go(e.shiftKey ? -1 : 1)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              close(true)
            }
          }}
        />
        <span className="find-count" aria-live="polite">
          {query
            ? matches.length
              ? t('find.count', { current: current + 1, total: matches.length })
              : t('find.none')
            : ''}
        </span>
        <button
          className={`find-case ${matchCase ? 'active' : ''}`}
          aria-pressed={matchCase}
          title={t('find.matchCase')}
          aria-label={t('find.matchCase')}
          onClick={() => setMatchCase((v) => !v)}
        >
          Aa
        </button>
        <button
          className="icon-button"
          disabled={!matches.length}
          title={t('find.previous')}
          aria-label={t('find.previous')}
          onClick={() => go(-1)}
        >
          <ChevronUpIcon size={14} />
        </button>
        <button
          className="icon-button"
          disabled={!matches.length}
          title={t('find.next')}
          aria-label={t('find.next')}
          onClick={() => go(1)}
        >
          <ChevronDownIcon size={14} />
        </button>
        <button
          className="icon-button"
          title={t('find.close')}
          aria-label={t('find.close')}
          onClick={() => close(false)}
        >
          <CloseIcon size={14} />
        </button>
      </div>
      {showReplace && (
        <div className="find-row">
          <span className="find-toggle-spacer" />
          <input
            className="find-input"
            value={replacement}
            placeholder={t('find.replacePlaceholder')}
            aria-label={t('find.replacePlaceholder')}
            spellCheck={false}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (e.metaKey) replaceEvery()
                else replaceOne()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                close(true)
              }
            }}
          />
          <button className="button small" disabled={!matches.length} onClick={replaceOne}>
            {t('find.replace')}
          </button>
          <button className="button small" disabled={!matches.length} onClick={replaceEvery}>
            {t('find.replaceAll')}
          </button>
        </div>
      )}
    </div>
  )
}
