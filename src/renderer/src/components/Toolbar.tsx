import { useTranslation } from 'react-i18next'
import { acceleratorGlyphs, COMMANDS } from '@shared/keymap'
import { dirname } from '@shared/paths'
import type { TreeNode } from '@shared/types'
import { useStore, titleOf } from '../store'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ClockIcon,
  GraphIcon,
  ModeMarkdownIcon,
  ModeRichIcon,
  ModeSplitIcon,
  InfoIcon,
  OutlineIcon,
  SearchIcon,
  SidebarIcon,
  StarIcon
} from './Icons'
import type { SaveStatus } from './PageView'

const glyph = (id: string): string =>
  acceleratorGlyphs(COMMANDS.find((c) => c.id === id)?.accelerator)

/** Ancestors of a page: for `A/B/C.md` → pages `A.md`, `A/B.md` if they exist, else folders. */
type Crumb = { label: string; path: string | null; folder: string | null }

function crumbs(path: string, tree: TreeNode[]): Crumb[] {
  const out: Crumb[] = []
  const pages = new Set<string>()
  const walk = (nodes: TreeNode[]): void => {
    for (const n of nodes) {
      if (n.path) pages.add(n.path)
      if (n.children) walk(n.children)
    }
  }
  walk(tree)
  let dir = dirname(path)
  while (dir) {
    const asPage = dir + '.md'
    out.unshift({
      label: pages.has(asPage) ? titleOf(asPage) : dir.split('/').pop()!,
      path: pages.has(asPage) ? asPage : null,
      folder: pages.has(asPage) ? null : dir
    })
    dir = dirname(dir)
  }
  out.push({ label: titleOf(path), path, folder: null })
  return out
}

/** Ancestors of a plain folder, ending with the folder itself. */
function folderCrumbs(folder: string, tree: TreeNode[]): Crumb[] {
  return crumbs(folder + '/_.md', tree).slice(0, -1)
}

export function Toolbar({ status }: { status: SaveStatus }): React.JSX.Element {
  const { t } = useTranslation()
  const view = useStore((s) => s.view)
  const tree = useStore((s) => s.tree)
  const back = useStore((s) => s.back)
  const forward = useStore((s) => s.forward)
  const sidebarVisible = useStore((s) => s.sidebarVisible)
  const favorites = useStore((s) => s.favorites)
  const words = useStore((s) => s.wordCount)
  const outlineOpen = useStore((s) => s.outlineOpen)
  const infoOpen = useStore((s) => s.infoOpen)
  const focusMode = useStore((s) => s.focusMode)
  const editorMode = useStore((s) => s.editorMode)
  const s = useStore.getState
  const page = view.kind === 'page' ? view.path : null
  const trail =
    view.kind === 'page'
      ? crumbs(view.path, tree)
      : view.kind === 'folder'
        ? folderCrumbs(view.folder, tree)
        : null

  return (
    <header className="toolbar">
      {!sidebarVisible && (
        <button
          className="icon-button"
          title={`${t('sidebar.toggle')} ${glyph('sidebar.toggle')}`}
          onClick={() => s().toggleSidebar()}
        >
          <SidebarIcon />
        </button>
      )}
      <button
        className="icon-button"
        disabled={!back.length}
        title={`${t('cmd.back')} ${glyph('nav.back')}`}
        onClick={() => s().goBack()}
      >
        <ArrowLeftIcon />
      </button>
      <button
        className="icon-button"
        disabled={!forward.length}
        title={`${t('cmd.forward')} ${glyph('nav.forward')}`}
        onClick={() => s().goForward()}
      >
        <ArrowRightIcon />
      </button>
      {trail && (
        <nav className="breadcrumb" aria-label={t('page.breadcrumb')}>
          {trail.map((c, i, all) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <span className="sep">›</span>}
              <button
                className={c.folder ? 'crumb-folder' : undefined}
                aria-current={i === all.length - 1 ? 'page' : undefined}
                onClick={() =>
                  c.path
                    ? s().openPage(c.path)
                    : c.folder && s().navigate({ kind: 'folder', folder: c.folder })
                }
              >
                {c.label}
              </button>
            </span>
          ))}
        </nav>
      )}
      <div className="spacer" />
      {page && (
        <span
          className="toolbar-status"
          title={status === 'saving' || status === 'dirty' ? t('page.saving') : t('page.saved')}
        >
          <span
            className={`save-dot ${status === 'saving' || status === 'dirty' ? 'pending' : ''}`}
            aria-hidden="true"
          />
          {/* Focus mode is about the text, not about counting it */}
          {!focusMode && t('page.words', { count: words })}
        </span>
      )}
      {page && (
        <>
          <button
            className="icon-button"
            aria-pressed={favorites.includes(page)}
            title={`${t('page.favorite')} ${glyph('page.favorite')}`}
            onClick={() => void s().toggleFavorite(page)}
          >
            <StarIcon filled={favorites.includes(page)} />
          </button>
          <div className="mode-switch" role="radiogroup" aria-label={t('page.mode')}>
            {(
              [
                ['rich', ModeRichIcon, 'cmd.modeRich', 'view.modeRich'],
                ['markdown', ModeMarkdownIcon, 'cmd.modeMarkdown', 'view.modeMarkdown'],
                ['split', ModeSplitIcon, 'cmd.modeSplit', 'view.modeSplit']
              ] as const
            ).map(([m, ModeIcon, label, cmd]) => (
              <button
                key={m}
                role="radio"
                aria-checked={editorMode === m}
                title={`${t(label)} ${glyph(cmd)}`}
                onClick={() => s().setEditorMode(m)}
              >
                <ModeIcon />
              </button>
            ))}
          </div>
          <button
            className="icon-button"
            title={t('graph.pageButton')}
            onClick={() => s().navigate({ kind: 'graph', center: page })}
          >
            <GraphIcon />
          </button>
          <button
            className="icon-button"
            title={`${t('cmd.pageHistory')} ${glyph('page.history')}`}
            onClick={() => s().setSheet({ kind: 'history', path: page })}
          >
            <ClockIcon />
          </button>
          <button
            className="icon-button"
            aria-pressed={outlineOpen}
            title={`${t('cmd.outline')} ${glyph('page.outline')}`}
            onClick={() => s().toggleOutline()}
          >
            <OutlineIcon />
          </button>
          <button
            className="icon-button"
            id="info-button"
            aria-pressed={infoOpen}
            aria-expanded={infoOpen}
            title={`${t('cmd.pageInfo')} ${glyph('page.info')}`}
            onClick={() => s().setInfoOpen(!s().infoOpen)}
          >
            <InfoIcon />
          </button>
        </>
      )}
      <button
        className="icon-button"
        title={`${t('cmd.palette')} ${glyph('palette.open')}`}
        onClick={() => s().setPalette(true, 'all')}
      >
        <SearchIcon />
      </button>
    </header>
  )
}
