import { Command } from 'cmdk'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COMMANDS, acceleratorGlyphs } from '@shared/keymap'
import { childFolderOf, isWithin } from '@shared/paths'
import type { TemplateInfo, TreeNode } from '@shared/types'
import { normalizeTitle } from '@shared/wikilinks'
import { invoke } from '../api'
import { runCommand } from '../commands'
import { fuzzyScore } from '../lib/fuzzy'
import { usePresence } from '../lib/hooks'
import { locale } from '../i18n'
import { useStore, type PaletteMode } from '../store'
import { CommandIcon, DocIcon, FolderIcon, PlusIcon, SearchIcon, VaultIcon } from './Icons'

const LIMIT = 40

/** Plain folders anywhere in the tree (move targets). */
function folderTargets(nodes: TreeNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.kind === 'folder') out.push(n.folder)
    if (n.children) folderTargets(n.children, out)
  }
  return out
}

export function CommandPalette(): React.JSX.Element | null {
  const { open, mode } = useStore((s) => s.palette)
  const { mounted, closing } = usePresence(open, 150)
  const setPalette = useStore((s) => s.setPalette)
  if (!mounted) return null
  return (
    <div
      className={`overlay ${closing ? 'closing' : ''}`}
      onPointerDown={(e) => e.target === e.currentTarget && setPalette(false)}
    >
      <PaletteBody mode={mode} />
    </div>
  )
}

function PaletteBody({ mode }: { mode: PaletteMode }): React.JSX.Element {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const titles = useStore((s) => s.titles)
  const titleIndex = useStore((s) => s.titleIndex)
  const recentPaths = useStore((s) => s.recent)
  const tree = useStore((s) => s.tree)
  const vault = useStore((s) => s.vault)
  const view = useStore((s) => s.view)
  const s = useStore.getState
  const close = (): void => s().setPalette(false)
  const page = view.kind === 'page' ? view.path : null

  useEffect(() => setQuery(''), [mode])
  useEffect(() => {
    if (mode === 'templates' || mode === 'all') void invoke('templates:list').then(setTemplates)
  }, [mode])

  // Without a query, the recently opened pages come first (except the open one)
  const recent = useMemo(() => {
    if ((mode !== 'all' && mode !== 'pages') || query.trim()) return []
    return recentPaths
      .filter((p) => p !== page)
      .map((p) => titleIndex.get(p))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .slice(0, 8)
  }, [mode, query, recentPaths, titleIndex, page])

  const pages = useMemo(() => {
    if (mode !== 'all' && mode !== 'pages' && mode !== 'move') return []
    let list = titles
    if (mode === 'move' && page)
      list = list.filter((m) => m.path !== page && !isWithin(childFolderOf(page), m.path))
    if (!query.trim()) {
      const shown = new Set(recent.map((m) => m.path))
      return list.filter((m) => !shown.has(m.path)).slice(0, LIMIT)
    }
    return list
      .map((m) => ({
        m,
        score: Math.max(fuzzyScore(m.title, query), fuzzyScore(m.path, query) * 0.6)
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, LIMIT)
      .map((x) => x.m)
  }, [titles, query, mode, page, recent])

  const commands = useMemo(() => {
    if (mode !== 'all') return []
    return COMMANDS.filter((c) => c.id !== 'palette.open')
      .map((c) => ({ c, score: fuzzyScore(t(c.label), query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, query ? 8 : 6)
      .map((x) => x.c)
  }, [mode, query, t])

  const exact = titles.some((m) => normalizeTitle(m.title) === normalizeTitle(query))
  const placeholder = {
    all: t('palette.placeholder'),
    pages: t('palette.placeholderPages'),
    templates: t('palette.placeholderTemplates'),
    vaults: t('palette.placeholderVaults'),
    move: t('palette.placeholderMove')
  }[mode]

  const pick = (fn: () => unknown): void => {
    close()
    void Promise.resolve(fn()).catch((err) => s().fail(err))
  }

  return (
    <Command
      className="palette glass"
      label={placeholder}
      shouldFilter={false}
      loop
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          close()
        }
      }}
    >
      <div className="input-wrap">
        <SearchIcon size={18} />
        <Command.Input autoFocus value={query} onValueChange={setQuery} placeholder={placeholder} />
      </div>
      <Command.List>
        <Command.Empty>{t('palette.empty')}</Command.Empty>

        {mode === 'move' && (
          <Command.Group heading={t('palette.folders')}>
            {folderTargets(tree)
              .filter((f) => fuzzyScore(f, query) > 0)
              .slice(0, 12)
              .map((f) => (
                <Command.Item
                  key={`dir:${f}`}
                  value={`dir:${f}`}
                  onSelect={() => pick(() => page && s().movePage(page, f))}
                >
                  <FolderIcon />
                  <span className="label">{f.split('/').pop()}</span>
                  {f.includes('/') && <span className="meta">{f.replace(/\/[^/]+$/, '')}</span>}
                </Command.Item>
              ))}
          </Command.Group>
        )}

        {mode === 'move' && (
          <Command.Group heading={t('palette.pages')}>
            <Command.Item
              value="__root"
              onSelect={() => pick(() => page && s().movePage(page, ''))}
            >
              <VaultIcon />
              <span className="label">{t('palette.moveToRoot')}</span>
            </Command.Item>
            {pages.map((m) => (
              <Command.Item
                key={m.path}
                value={`move:${m.path}`}
                onSelect={() => pick(() => page && s().movePage(page, m.path))}
              >
                {m.icon ? <span className="emoji">{m.icon}</span> : <DocIcon />}
                <span className="label">{m.title}</span>
                <span className="meta">{m.path.replace(/\.md$/, '')}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {recent.length > 0 && (
          <Command.Group heading={t('palette.recent')}>
            {recent.map((m) => (
              <Command.Item
                key={`recent:${m.path}`}
                value={`recent:${m.path}`}
                onSelect={() => pick(() => s().openPage(m.path))}
              >
                {m.icon ? <span className="emoji">{m.icon}</span> : <DocIcon />}
                <span className="label">{m.title}</span>
                {m.path.includes('/') && (
                  <span className="meta">{m.path.replace(/\/[^/]+$/, '')}</span>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {(mode === 'all' || mode === 'pages') && pages.length > 0 && (
          <Command.Group heading={t('palette.pages')}>
            {pages.map((m) => (
              <Command.Item
                key={m.path}
                value={`page:${m.path}`}
                onSelect={() => pick(() => s().openPage(m.path))}
              >
                {m.icon ? <span className="emoji">{m.icon}</span> : <DocIcon />}
                <span className="label">{m.title}</span>
                {m.path.includes('/') && (
                  <span className="meta">{m.path.replace(/\/[^/]+$/, '')}</span>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {(mode === 'all' || mode === 'pages') && query.trim() && (
          <Command.Group>
            {!exact && (
              <Command.Item
                value="__create"
                onSelect={() => pick(() => s().newPage('', query.trim()))}
              >
                <PlusIcon />
                <span className="label">{t('palette.create', { title: query.trim() })}</span>
                <span className="kbd">{acceleratorGlyphs('CmdOrCtrl+N')}</span>
              </Command.Item>
            )}
            <Command.Item
              value="__fulltext"
              onSelect={() =>
                pick(() => s().navigate({ kind: 'search', query: query.trim(), tag: null }))
              }
            >
              <SearchIcon />
              <span className="label">{t('palette.fulltext', { query: query.trim() })}</span>
            </Command.Item>
          </Command.Group>
        )}

        {commands.length > 0 && (
          <Command.Group heading={t('palette.commands')}>
            {commands.map((c) => (
              <Command.Item
                key={c.id}
                value={`cmd:${c.id}`}
                onSelect={() => pick(() => runCommand(c.id))}
              >
                <CommandIcon />
                <span className="label">{t(c.label)}</span>
                <span className="kbd">{acceleratorGlyphs(c.accelerator)}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {(mode === 'vaults' ||
          (mode === 'all' &&
            query.trim() &&
            (vault?.vaults ?? []).some((v) => fuzzyScore(v.name, query) > 0))) && (
          <Command.Group heading={t('palette.vaults')}>
            {(vault?.vaults ?? [])
              .filter((v) => fuzzyScore(v.name, query) > 0)
              .map((v) => (
                <Command.Item
                  key={v.id}
                  value={`vault:${v.id}`}
                  onSelect={() =>
                    pick(async () => s().setVault(await invoke('vault:switch', v.id)))
                  }
                >
                  <VaultIcon />
                  <span className="label">{v.name}</span>
                  <span className="meta">{v.id === vault?.current?.id ? '✓' : v.path}</span>
                </Command.Item>
              ))}
            {mode === 'vaults' && (
              <>
                <Command.Item
                  value="__openVault"
                  onSelect={() => pick(() => runCommand('vault.open'))}
                >
                  <PlusIcon />
                  <span className="label">{t('vault.add')}</span>
                </Command.Item>
                <Command.Item
                  value="__createVault"
                  onSelect={() => pick(() => runCommand('vault.create'))}
                >
                  <PlusIcon />
                  <span className="label">{t('vault.create')}</span>
                </Command.Item>
              </>
            )}
          </Command.Group>
        )}

        {mode === 'templates' && (
          <Command.Group heading={t('palette.templates')}>
            {templates
              .filter((tpl) => fuzzyScore(tpl.name, query) > 0)
              .flatMap((tpl) => [
                page && (
                  <Command.Item
                    key={`ins:${tpl.path}`}
                    value={`ins:${tpl.path}`}
                    onSelect={() =>
                      pick(async () => {
                        const md = await invoke(
                          'templates:render',
                          tpl.path,
                          s().titleIndex.get(page)?.title ?? ''
                        )
                        s().editor?.insertMarkdown(md)
                      })
                    }
                  >
                    <DocIcon />
                    <span className="label">{tpl.name}</span>
                  </Command.Item>
                ),
                <Command.Item
                  key={`new:${tpl.path}`}
                  value={`new:${tpl.path}`}
                  onSelect={() =>
                    pick(async () => {
                      const title = `${tpl.name} ${new Intl.DateTimeFormat(locale()).format(new Date())}`
                      await s().newPage(
                        '',
                        title,
                        await invoke('templates:render', tpl.path, title)
                      )
                    })
                  }
                >
                  <PlusIcon />
                  <span className="label">
                    {t('palette.createFromTemplate', { name: tpl.name })}
                  </span>
                </Command.Item>
              ])}
          </Command.Group>
        )}
      </Command.List>
      <div className="footer">
        <span>{t('palette.footerSelect')}</span>
        <span>{t('palette.footerOpen')}</span>
        <span>{t('palette.footerClose')}</span>
      </div>
    </Command>
  )
}
