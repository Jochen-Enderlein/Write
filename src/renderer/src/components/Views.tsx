import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SearchHit, TrashEntry } from '@shared/types'
import { invoke } from '../api'
import { formatDate, useIpcEvent } from '../lib/hooks'
import { useStore } from '../store'
import { SearchIcon } from './Icons'
import { Snippet } from './Snippet'

export function SearchView({
  query,
  tag
}: {
  query: string
  tag: string | null
}): React.JSX.Element {
  const { t } = useTranslation()
  const tags = useStore((s) => s.tags)
  const navigate = useStore((s) => s.navigate)
  const openPage = useStore((s) => s.openPage)
  const [q, setQ] = useState(query)
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [ms, setMs] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => input.current?.focus(), [])

  const run = useCallback(async () => {
    if (!q.trim() && !tag) {
      setHits(null)
      return
    }
    const start = performance.now()
    const res = await invoke('index:search', q, tag)
    setMs(Math.round(performance.now() - start))
    setHits(res)
  }, [q, tag])

  useEffect(() => {
    const id = setTimeout(() => void run(), 60)
    return () => clearTimeout(id)
  }, [run])
  useIpcEvent('index:updated', () => void run())

  return (
    <div className="view">
      <h1>{t('search.title')}</h1>
      <label className="search-field">
        <SearchIcon size={17} />
        <input
          ref={input}
          value={q}
          placeholder={t('search.placeholder')}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate({ kind: 'search', query: q, tag }, { replace: true })
            if (e.key === 'ArrowDown')
              (document.querySelector('.result') as HTMLElement | null)?.focus()
          }}
        />
      </label>
      {tags.length > 0 && (
        <div className="chips" role="group" aria-label={t('tags.title')}>
          <button
            className={`chip ${tag === null ? 'active' : ''}`}
            onClick={() => navigate({ kind: 'search', query: q, tag: null }, { replace: true })}
          >
            {t('search.allTags')}
          </button>
          {tags.slice(0, 30).map((tg) => (
            <button
              key={tg.tag}
              className={`chip ${tag === tg.tag ? 'active' : ''}`}
              onClick={() =>
                navigate(
                  { kind: 'search', query: q, tag: tag === tg.tag ? null : tg.tag },
                  { replace: true }
                )
              }
            >
              #{tg.tag}
              <span className="count">{tg.count}</span>
            </button>
          ))}
        </div>
      )}
      {hits === null ? (
        <p className="lead" style={{ marginTop: 16 }}>
          {t('search.hint')}
        </p>
      ) : (
        <>
          <div className="result-count">
            {t('search.results', { count: hits.length })} · {ms} ms
          </div>
          {hits.length === 0 && <p className="lead">{t('search.none')}</p>}
          {hits.map((h) => (
            <button
              key={h.path}
              className="result"
              onClick={() => {
                // The page opens with the find bar showing the hits (longest search word)
                const word = q
                  .trim()
                  .split(/\s+/)
                  .sort((a, b) => b.length - a.length)[0]
                useStore.setState({ pendingFind: word || null })
                openPage(h.path)
                // Same page already open: no remount, so open the find bar directly
                const v = useStore.getState().view
                if (word && v.kind === 'page' && v.path === h.path)
                  useStore.getState().openFind(false)
              }}
              onKeyDown={(e) => {
                const el = e.currentTarget
                if (e.key === 'ArrowDown') (el.nextElementSibling as HTMLElement | null)?.focus()
                if (e.key === 'ArrowUp')
                  ((el.previousElementSibling as HTMLElement | null)?.classList.contains('result')
                    ? (el.previousElementSibling as HTMLElement)
                    : input.current
                  )?.focus()
              }}
            >
              <div className="title">
                {h.icon ? `${h.icon} ` : ''}
                {h.title}
                {h.path.includes('/') && (
                  <span className="path">{h.path.replace(/\/[^/]+$/, '')}</span>
                )}
              </div>
              <div className="snippet">
                <Snippet text={h.snippet} />
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  )
}

export function TagsView(): React.JSX.Element {
  const { t } = useTranslation()
  const tags = useStore((s) => s.tags)
  const navigate = useStore((s) => s.navigate)
  return (
    <div className="view">
      <h1>{t('tags.title')}</h1>
      {tags.length === 0 && <p className="lead">{t('tags.empty')}</p>}
      <div className="tag-grid">
        {tags.map((tg) => (
          <button
            key={tg.tag}
            className="chip"
            onClick={() => navigate({ kind: 'search', query: '', tag: tg.tag })}
          >
            #{tg.tag}
            <span className="count">{t('tags.pages', { count: tg.count })}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function TrashView(): React.JSX.Element {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<TrashEntry[]>([])
  const [days, setDays] = useState(30)
  const s = useStore.getState

  const load = useCallback(() => void invoke('trash:list').then(setEntries, s().fail), [s])
  useEffect(() => {
    load()
    void invoke('settings:get').then((st) => setDays(st.trashRetentionDays))
  }, [load])
  useIpcEvent('tree:changed', load)

  return (
    <div className="view">
      <h1>{t('trash.title')}</h1>
      <div className="view-actions">
        <span>{t('trash.retention', { days })}</span>
        {entries.length > 0 && (
          <button
            className="button danger"
            onClick={async () => {
              if (!window.confirm(t('trash.confirmEmpty'))) return
              await invoke('trash:empty').catch(s().fail)
              load()
            }}
          >
            {t('trash.emptyAll')}
          </button>
        )}
      </div>
      {entries.length === 0 && <p className="lead">{t('trash.empty')}</p>}
      {entries.map((e) => (
        <div key={e.id} className="list-row">
          <div className="main-col">
            <div className="title">{e.title}</div>
            <div className="sub">
              {e.kind === 'folder' ? `${t('trash.folder')} · ` : ''}
              {formatDate(e.deletedAt)} · {t('trash.from', { path: e.originalPath })}
            </div>
          </div>
          <button
            className="button"
            onClick={async () => {
              await s().restoreFromTrash(e.id, e.title)
              load()
            }}
          >
            {t('trash.restore')}
          </button>
          <button
            className="button danger"
            onClick={async () => {
              if (!window.confirm(t('trash.confirmDelete', { title: e.title }))) return
              await invoke('trash:delete', e.id).catch(s().fail)
              load()
            }}
          >
            {t('trash.deleteForever')}
          </button>
        </div>
      ))}
    </div>
  )
}
