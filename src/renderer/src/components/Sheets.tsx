import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConflictInfo, HistoryEntry } from '@shared/types'
import { invoke } from '../api'
import { relativeTime, formatDate, usePresence } from '../lib/hooks'
import { useStore, type Sheet } from '../store'
import { DiffView } from './DiffView'
import { SettingsSheet } from './SettingsSheet'
import { ShortcutsSheet } from './ShortcutsSheet'

/** Sheets drop from the toolbar over a dimmed window and return the same way. */
export function SheetHost(): React.JSX.Element | null {
  const sheet = useStore((s) => s.sheet)
  const [last, setLast] = useState<Sheet>(sheet)
  useEffect(() => {
    if (sheet) setLast(sheet)
  }, [sheet])
  const { mounted, closing } = usePresence(sheet !== null, 180)
  const close = (): void => useStore.getState().setSheet(null)
  const dialog = useRef<HTMLDivElement>(null)
  const isOpen = sheet !== null

  // Modal for real: the window behind can't be typed into or tabbed to, focus moves into the
  // sheet and returns to where it was (e.g. the cursor in the editor) once it closes
  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const behind = [...document.querySelectorAll<HTMLElement>('.app > .sidebar, .app > .main')]
    for (const el of behind) el.inert = true
    // A sheet that focuses its own field (e.g. the shortcut search) keeps that
    if (!dialog.current?.contains(document.activeElement))
      dialog.current?.focus({ preventScroll: true })
    return () => {
      for (const el of behind) el.inert = false
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [isOpen])

  useEffect(() => {
    if (!sheet) return
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [sheet])

  const shown = sheet ?? last
  if (!mounted || !shown) return null
  return (
    <div
      className={`overlay dim ${closing ? 'closing' : ''}`}
      onPointerDown={(e) => e.target === e.currentTarget && close()}
    >
      <div ref={dialog} className="sheet glass" role="dialog" aria-modal="true" tabIndex={-1}>
        {shown.kind === 'history' && <HistorySheet path={shown.path} onClose={close} />}
        {shown.kind === 'conflicts' && <ConflictsSheet onClose={close} />}
        {shown.kind === 'settings' && <SettingsSheet onClose={close} />}
        {shown.kind === 'shortcuts' && <ShortcutsSheet onClose={close} />}
        {shown.kind === 'compare' && (
          <CompareSheet mine={shown.mine} theirs={shown.theirs} onClose={close} />
        )}
      </div>
    </div>
  )
}

function HistorySheet({ path, onClose }: { path: string; onClose(): void }): React.JSX.Element {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [current, setCurrent] = useState('')
  const s = useStore.getState

  useEffect(() => {
    void (async () => {
      await s().editor?.flush()
      const [list, file] = await Promise.all([
        invoke('history:list', path),
        invoke('page:read', path)
      ])
      setEntries(list)
      setCurrent(file.text)
      setSelected(list[1]?.oid ?? list[0]?.oid ?? null)
    })().catch(s().fail)
  }, [path, s])

  useEffect(() => {
    if (selected) void invoke('history:read', path, selected).then(setContent, () => setContent(''))
  }, [path, selected])

  return (
    <>
      <div className="sheet-header">
        <h2>{t('history.title')}</h2>
        <button className="button" onClick={onClose}>
          {t('common.done')}
        </button>
      </div>
      <div className="sheet-body">
        <div className="version-list" role="listbox" aria-label={t('history.title')}>
          {entries?.length === 0 && (
            <p className="lead" style={{ padding: 10 }}>
              {t('history.empty')}
            </p>
          )}
          {entries?.map((e) => (
            <button
              key={e.oid}
              role="option"
              aria-selected={selected === e.oid}
              className={`version ${selected === e.oid ? 'active' : ''}`}
              onClick={() => setSelected(e.oid)}
            >
              <div className="when">{relativeTime(e.timestamp)}</div>
              <div className="what">
                {formatDate(e.timestamp)} · {e.message}
              </div>
            </button>
          ))}
        </div>
        {selected ? (
          <DiffView before={content} after={current} emptyText={t('history.noChanges')} />
        ) : (
          <div className="diff" />
        )}
      </div>
      <div className="sheet-footer">
        <span style={{ flex: 1, alignSelf: 'center', fontSize: 12, color: 'var(--label-3)' }}>
          {t('history.compareHint')}
        </span>
        <button
          className="button primary"
          disabled={!selected || content === current}
          onClick={async () => {
            if (!selected) return
            try {
              await invoke('history:restore', path, selected)
              s().notify(t('history.restored'))
              onClose()
            } catch (err) {
              s().fail(err)
            }
          }}
        >
          {t('history.restore')}
        </button>
      </div>
    </>
  )
}

function ConflictsSheet({ onClose }: { onClose(): void }): React.JSX.Element {
  const { t } = useTranslation()
  const conflicts = useStore((s) => s.conflicts)
  const [selected, setSelected] = useState<ConflictInfo | null>(conflicts[0] ?? null)
  const [texts, setTexts] = useState<{ mine: string; theirs: string } | null>(null)
  const s = useStore.getState

  useEffect(() => {
    if (!selected && conflicts[0]) setSelected(conflicts[0])
  }, [conflicts, selected])

  const load = useCallback(() => {
    if (selected) void invoke('conflicts:read', selected.conflictPath).then(setTexts, s().fail)
  }, [selected, s])
  useEffect(load, [load])

  const resolve = async (action: 'keepMine' | 'takeTheirs' | 'keepBoth'): Promise<void> => {
    if (!selected) return
    try {
      await invoke('conflicts:resolve', selected.conflictPath, action)
      const rest = await invoke('conflicts:list')
      useStore.setState({ conflicts: rest })
      setSelected(rest[0] ?? null)
      if (!rest.length) onClose()
    } catch (err) {
      s().fail(err)
    }
  }

  return (
    <>
      <div className="sheet-header">
        <h2>{t('conflicts.title')}</h2>
        <button className="button" onClick={onClose}>
          {t('common.done')}
        </button>
      </div>
      {conflicts.length === 0 ? (
        <p className="lead" style={{ padding: 22 }}>
          {t('conflicts.none')}
        </p>
      ) : (
        <>
          <p className="lead" style={{ margin: '12px 22px 0' }}>
            {t('conflicts.description')}
          </p>
          <div className="sheet-body" style={{ marginTop: 10 }}>
            <div className="version-list">
              {conflicts.map((c) => (
                <button
                  key={c.conflictPath}
                  className={`version ${selected?.conflictPath === c.conflictPath ? 'active' : ''}`}
                  onClick={() => setSelected(c)}
                >
                  <div className="when">{c.originalPath.replace(/\.md$/, '')}</div>
                  <div className="what">{c.conflictPath.split('/').pop()}</div>
                </button>
              ))}
            </div>
            {texts && (
              <DiffView
                before={texts.mine}
                after={texts.theirs}
                emptyText={t('history.noChanges')}
              />
            )}
          </div>
          <div className="sheet-footer">
            <button className="button" onClick={() => void resolve('keepBoth')}>
              {t('conflicts.keepBoth')}
            </button>
            <button className="button" onClick={() => void resolve('takeTheirs')}>
              {t('conflicts.takeTheirs')}
            </button>
            <button className="button primary" onClick={() => void resolve('keepMine')}>
              {t('conflicts.keepMine')}
            </button>
          </div>
        </>
      )}
    </>
  )
}

function CompareSheet({
  mine,
  theirs,
  onClose
}: {
  mine: string
  theirs: string
  onClose(): void
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <>
      <div className="sheet-header">
        <h2>{t('page.compare')}</h2>
        <button className="button" onClick={onClose}>
          {t('common.done')}
        </button>
      </div>
      <div className="sheet-body">
        <DiffView before={theirs} after={mine} emptyText={t('history.noChanges')} />
      </div>
    </>
  )
}
