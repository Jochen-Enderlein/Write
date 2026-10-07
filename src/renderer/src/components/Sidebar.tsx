import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { acceleratorGlyphs, COMMANDS } from '@shared/keymap'
import { dayKey } from '@shared/dates'
import { invoke } from '../api'
import { LINKS } from '@shared/links'
import { createSpring, rubberband } from '../lib/spring'
import { installUpdate } from '../lib/updates'
import { useStore, titleOf } from '../store'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { PageTree } from './PageTree'
import {
  CalendarIcon,
  FolderPlusIcon,
  GearIcon,
  GraphIcon,
  ChevronDownIcon,
  PlusIcon,
  SearchIcon,
  SidebarIcon,
  StarIcon,
  TagIcon,
  TrashIcon,
  WarningIcon
} from './Icons'

const glyph = (id: string): string =>
  acceleratorGlyphs(COMMANDS.find((c) => c.id === id)?.accelerator)

export const SIDEBAR_MIN = 200
export const SIDEBAR_MAX = 420

export function Sidebar({
  width,
  onResize
}: {
  width: number
  onResize(w: number, live: boolean): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const vault = useStore((s) => s.vault)
  const view = useStore((s) => s.view)
  const favorites = useStore((s) => s.favorites)
  const conflicts = useStore((s) => s.conflicts)
  const indexStatus = useStore((s) => s.indexStatus)
  const notices = useStore((s) => s.notices)
  const update = useStore((s) => s.update)
  const titleIndex = useStore((s) => s.titleIndex)
  const s = useStore.getState
  const [vaultMenu, setVaultMenu] = useState<{ x: number; y: number } | null>(null)
  const today = dayKey()
  const isToday =
    view.kind === 'page' && view.path.endsWith(`${today}.md`) && view.path.startsWith('Journal/')

  const vaultItems: MenuItem[] = [
    ...(vault?.vaults ?? []).map((v) => ({
      label: (v.id === vault?.current?.id ? '✓ ' : '  ') + v.name,
      onSelect: () => void invoke('vault:switch', v.id).then((st) => s().setVault(st), s().fail)
    })),
    {
      label: t('vault.add'),
      separatorBefore: true,
      onSelect: () => void invoke('vault:openDialog').then((st) => s().setVault(st), s().fail)
    },
    {
      label: t('vault.create'),
      onSelect: () => void invoke('vault:create').then((st) => s().setVault(st), s().fail)
    }
  ]

  return (
    <aside className="sidebar" aria-label={t('sidebar.toggle')}>
      <div className="sidebar-inner">
        <div className="sidebar-titlebar">
          <button
            className="icon-button"
            title={`${t('sidebar.toggle')} ${glyph('sidebar.toggle')}`}
            onClick={() => s().toggleSidebar()}
          >
            <SidebarIcon />
          </button>
        </div>

        <button
          className="vault-switcher"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setVaultMenu({ x: r.left, y: r.bottom + 4 })
          }}
          aria-haspopup="menu"
        >
          <span className="vault-icon">
            {(vault?.current?.name ?? 'W').slice(0, 1).toUpperCase()}
          </span>
          <span className="label">{vault?.current?.name}</span>
          <ChevronDownIcon size={13} />
        </button>
        {vaultMenu && (
          <ContextMenu {...vaultMenu} items={vaultItems} onClose={() => setVaultMenu(null)} />
        )}

        <div className="sidebar-section">
          <button
            className={`sidebar-item ${isToday ? 'active' : ''}`}
            onClick={() => void s().openJournal()}
          >
            <CalendarIcon />
            <span className="label">{t('sidebar.today')}</span>
            <span className="shortcut">{glyph('journal.today')}</span>
          </button>
          <button
            className={`sidebar-item ${view.kind === 'search' ? 'active' : ''}`}
            onClick={() => s().navigate({ kind: 'search', query: '', tag: null })}
          >
            <SearchIcon />
            <span className="label">{t('sidebar.search')}</span>
            <span className="shortcut">{glyph('search.fulltext')}</span>
          </button>
          <button
            className={`sidebar-item ${view.kind === 'graph' && view.center === null ? 'active' : ''}`}
            onClick={() => s().navigate({ kind: 'graph', center: null })}
          >
            <GraphIcon />
            <span className="label">{t('sidebar.graph')}</span>
            <span className="shortcut">{glyph('graph.show')}</span>
          </button>
        </div>

        {favorites.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-heading">{t('sidebar.favorites')}</div>
            {favorites.map((p) => (
              <button
                key={p}
                className={`sidebar-item ${view.kind === 'page' && view.path === p ? 'active' : ''}`}
                onClick={() => s().openPage(p)}
              >
                {titleIndex.get(p)?.icon ? (
                  <span style={{ width: 16, textAlign: 'center' }}>{titleIndex.get(p)!.icon}</span>
                ) : (
                  <StarIcon />
                )}
                <span className="label">{titleOf(p)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="sidebar-section">
          <div className="sidebar-heading">
            {t('sidebar.pages')}
            <span className="heading-actions">
              <button
                className="icon-button"
                title={`${t('sidebar.newFolder')} ${glyph('folder.new')}`}
                aria-label={t('sidebar.newFolder')}
                onClick={() => void s().newFolder('')}
              >
                <FolderPlusIcon size={14} />
              </button>
              <button
                className="icon-button"
                title={`${t('sidebar.newPage')} ${glyph('page.new')}`}
                aria-label={t('sidebar.newPage')}
                onClick={() => void s().newPage('')}
              >
                <PlusIcon size={14} />
              </button>
            </span>
          </div>
        </div>
        <PageTree />

        <div className="sidebar-footer">
          {conflicts.length > 0 && (
            <button
              className="sidebar-item warning"
              onClick={() => s().setSheet({ kind: 'conflicts' })}
            >
              <WarningIcon />
              <span className="label">{t('sidebar.conflicts', { count: conflicts.length })}</span>
            </button>
          )}
          <button
            className={`sidebar-item ${view.kind === 'tags' ? 'active' : ''}`}
            onClick={() => s().navigate({ kind: 'tags' })}
          >
            <TagIcon />
            <span className="label">{t('sidebar.tags')}</span>
          </button>
          <button
            className={`sidebar-item ${view.kind === 'trash' ? 'active' : ''}`}
            onClick={() => s().navigate({ kind: 'trash' })}
          >
            <TrashIcon />
            <span className="label">{t('sidebar.trash')}</span>
          </button>
          <button className="sidebar-item" onClick={() => s().setSheet({ kind: 'settings' })}>
            <GearIcon />
            <span className="label">{t('sidebar.settings')}</span>
            <span className="shortcut">{glyph('settings.open')}</span>
          </button>
          {notices.map((n) => (
            <div key={n.kind} className="index-progress" role="status">
              <WarningIcon size={13} style={{ color: 'var(--orange)', flex: 'none' }} />
              <span>{t(n.message)}</span>
            </div>
          ))}
          {update.state === 'downloading' && (
            <div className="index-progress" role="status">
              <span>{t('update.downloadingShort', { version: update.version })}</span>
              <progress max={100} value={update.percent} />
            </div>
          )}
          {/* Stays until restarted: unlike a notification, it can't be missed */}
          {update.state === 'ready' && (
            <div className="update-notice" role="status">
              <div className="update-text">
                <span className="update-title">
                  {t('update.readyTitle', { version: update.version })}
                </span>
                <a
                  className="update-link"
                  href={`${LINKS.releases}/tag/v${update.version}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('update.whatsNew')}
                </a>
              </div>
              <button className="button primary small" onClick={installUpdate}>
                {t('update.restart')}
              </button>
            </div>
          )}
          {indexStatus.state === 'indexing' && indexStatus.total > 0 && (
            <div className="index-progress" role="status">
              <span>
                {t('sidebar.indexing', { done: indexStatus.done, total: indexStatus.total })}
              </span>
              <progress max={indexStatus.total} value={indexStatus.done} />
            </div>
          )}
        </div>
      </div>
      <Resizer width={width} onResize={onResize} />
    </aside>
  )
}

/**
 * Drag handle for the sidebar width: tracks the pointer 1:1 from where it was grabbed, resists
 * softly past the limits and springs back into range on release.
 */
function Resizer({
  width,
  onResize
}: {
  width: number
  onResize(w: number, live: boolean): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const drag = useRef<{ startX: number; startW: number; raw: number } | null>(null)
  const el = useRef<HTMLDivElement>(null)
  const spring = useRef(
    createSpring(
      width,
      (v) => {
        // The parent doesn't re-render while resizing, so keep the reported value live here
        el.current?.setAttribute('aria-valuenow', String(Math.round(v)))
        onResize(v, true)
      },
      (v) => onResize(v, false)
    )
  )

  const clampSoft = (w: number): number => {
    if (w < SIDEBAR_MIN) return SIDEBAR_MIN - rubberband(SIDEBAR_MIN - w, SIDEBAR_MIN)
    if (w > SIDEBAR_MAX) return SIDEBAR_MAX + rubberband(w - SIDEBAR_MAX, SIDEBAR_MAX)
    return w
  }

  const release = (): void => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const target = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, d.raw))
    spring.current.to(target, { damping: 1, response: 0.3 })
  }

  return (
    <div
      ref={el}
      className="sidebar-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={t('sidebar.resize')}
      aria-valuenow={Math.round(width)}
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      tabIndex={0}
      onKeyDown={(e) => {
        // The width prop can lag behind (the parent keeps it in a ref), so read the live value
        const step = e.shiftKey ? 40 : 10
        const w = spring.current.value
        let next: number | null = null
        if (e.key === 'ArrowLeft') next = Math.max(SIDEBAR_MIN, w - step)
        if (e.key === 'ArrowRight') next = Math.min(SIDEBAR_MAX, w + step)
        if (next === null) return
        e.preventDefault()
        spring.current.set(next)
        onResize(next, false)
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        spring.current.stop()
        // Start from what is on screen, not from the (possibly stale) prop
        const w = spring.current.value
        drag.current = { startX: e.clientX, startW: w, raw: w }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        d.raw = d.startW + (e.clientX - d.startX)
        const w = clampSoft(d.raw)
        spring.current.set(w)
        onResize(w, true)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onDoubleClick={() => spring.current.to(264, { damping: 1, response: 0.35 })}
    />
  )
}
