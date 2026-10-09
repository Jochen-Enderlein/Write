import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppSettings, McpLaunch } from '@shared/types'
import { acceleratorGlyphs, DEFAULT_CAPTURE_SHORTCUT } from '@shared/keymap'
import { invoke } from '../api'
import { LINKS } from '@shared/links'
import { setTheme } from '../lib/theme'
import { checkForUpdates } from '../lib/updates'
import { useStore } from '../store'
import { VaultIcon, WarningIcon } from './Icons'

/** Settings grouped like macOS System Settings: inset sections with labelled rows. */
export function SettingsSheet({ onClose }: { onClose(): void }): React.JSX.Element {
  const { t } = useTranslation()
  const vault = useStore((s) => s.vault)
  const indexStatus = useStore((s) => s.indexStatus)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [paths, setPaths] = useState<{
    vault: string | null
    data: string | null
    version: string
  } | null>(null)
  /** A shorter trash retention that would purge pages already in the trash, awaiting a yes. */
  const [trashWarning, setTrashWarning] = useState<{ days: number; count: number } | null>(null)
  const s = useStore.getState

  // Changes made elsewhere while the sheet is open (e.g. the theme toggle in the menu)
  const live = useStore((st) => st.settings)
  useEffect(() => {
    if (live) setSettings(live)
  }, [live])

  useEffect(() => {
    void invoke('settings:get').then(setSettings)
    void invoke('app:paths').then(setPaths)
  }, [vault?.current?.id])

  const update = async (patch: Partial<AppSettings>): Promise<void> => {
    try {
      const next = await invoke('settings:set', patch)
      setSettings(next)
      useStore.setState({ settings: next })
    } catch (err) {
      s().fail(err)
      setSettings(await invoke('settings:get'))
    }
  }

  // Shortening the retention deletes for good on the next purge; say how much before doing it
  const changeTrashRetention = async (days: number): Promise<void> => {
    setTrashWarning(null)
    const before = settings?.trashRetentionDays ?? 0
    if (days !== 0 && (before === 0 || days < before)) {
      const cutoff = Date.now() - days * 86_400_000
      const list = await invoke('trash:list').catch(() => [])
      const count = list.filter((e) => Date.parse(e.deletedAt) < cutoff).length
      if (count) return setTrashWarning({ days, count })
    }
    await update({ trashRetentionDays: days })
  }

  const forget = async (id: string, name: string): Promise<void> => {
    try {
      s().setVault(await invoke('vault:forget', id))
      s().notify(t('settings.forgotten', { name }), {
        label: t('trash.undo'),
        run: () => void invoke('vault:unforget', id).then((st) => s().setVault(st), s().fail)
      })
    } catch (err) {
      s().fail(err)
    }
  }

  return (
    <>
      <div className="sheet-header">
        <h2>{t('settings.title')}</h2>
        <button className="button" onClick={onClose}>
          {t('common.done')}
        </button>
      </div>
      <div className="settings">
        {/* Most used first: how the text looks */}
        <section>
          <h3>{t('settings.appearance')}</h3>
          <div className="group">
            {settings && (
              <>
                <div className="row">
                  <div className="row-main">
                    <div className="row-title">{t('settings.theme')}</div>
                  </div>
                  <div className="segmented" role="radiogroup" aria-label={t('settings.theme')}>
                    {(['system', 'light', 'dark'] as const).map((th) => (
                      <button
                        key={th}
                        role="radio"
                        aria-checked={settings.theme === th}
                        onClick={() => {
                          setSettings({ ...settings, theme: th })
                          void setTheme(th)
                        }}
                      >
                        {t(`settings.theme${th[0]!.toUpperCase()}${th.slice(1)}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="row">
                  <div className="row-main">
                    <div className="row-title">{t('settings.font')}</div>
                  </div>
                  <div className="segmented" role="radiogroup" aria-label={t('settings.font')}>
                    {(['sans', 'serif', 'mono'] as const).map((f) => (
                      <button
                        key={f}
                        role="radio"
                        aria-checked={settings.editorFont === f}
                        className={`font-${f}`}
                        onClick={() => void update({ editorFont: f })}
                      >
                        {t(`settings.font${f[0]!.toUpperCase()}${f.slice(1)}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="row">
                  <div className="row-main">
                    <div className="row-title">{t('settings.fontSize')}</div>
                  </div>
                  <input
                    type="range"
                    min={13}
                    max={24}
                    step={1}
                    value={settings.editorFontSize}
                    aria-label={t('settings.fontSize')}
                    onChange={(e) => {
                      const editorFontSize = Number(e.target.value)
                      setSettings({ ...settings, editorFontSize })
                      useStore.setState({ settings: { ...settings, editorFontSize } })
                    }}
                    onPointerUp={(e) =>
                      void update({ editorFontSize: Number(e.currentTarget.value) })
                    }
                    onKeyUp={(e) => void update({ editorFontSize: Number(e.currentTarget.value) })}
                  />
                  <span className="range-value">{settings.editorFontSize} px</span>
                </div>
                {/* The editor sits behind the dimmed sheet, so show the result right here */}
                <div className="row">
                  <p className="settings-preview">{t('settings.previewText')}</p>
                </div>
                <div className="row">
                  <div className="row-main">
                    <div className="row-title">{t('settings.width')}</div>
                  </div>
                  <select
                    value={settings.editorWidth}
                    aria-label={t('settings.width')}
                    onChange={(e) =>
                      void update({ editorWidth: e.target.value as AppSettings['editorWidth'] })
                    }
                  >
                    {(['narrow', 'normal', 'wide', 'full'] as const).map((w) => (
                      <option key={w} value={w}>
                        {t(`settings.width${w[0]!.toUpperCase()}${w.slice(1)}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="row">
                  <div className="row-main">
                    <div className="row-title">{t('settings.language')}</div>
                    <div className="row-sub">{t('settings.languageHint')}</div>
                  </div>
                  <select
                    value={settings.language}
                    aria-label={t('settings.language')}
                    onChange={(e) =>
                      void update({ language: e.target.value as AppSettings['language'] })
                    }
                  >
                    <option value="system">{t('settings.languageSystem')}</option>
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <p className="settings-note">{t('settings.themeNote')}</p>
        </section>

        <section>
          <h3>{t('settings.vaults')}</h3>
          <div className="group">
            {(vault?.vaults ?? []).map((v) => {
              const isCurrent = v.id === vault?.current?.id
              return (
                <div key={v.id} className="row">
                  <VaultIcon />
                  <div className="row-main">
                    <div className="row-title">
                      {v.name}
                      {isCurrent && <span className="badge">{t('settings.current')}</span>}
                    </div>
                    <div className="row-sub">{v.path.replace(/^\/Users\/[^/]+/, '~')}</div>
                  </div>
                  {isCurrent ? (
                    <button
                      className="button"
                      onClick={() => void invoke('app:revealPath', 'vault')}
                    >
                      {t('settings.showInFinder')}
                    </button>
                  ) : (
                    <>
                      <button
                        className="button"
                        onClick={() =>
                          void invoke('vault:switch', v.id).then((st) => s().setVault(st), s().fail)
                        }
                      >
                        {t('settings.open')}
                      </button>
                      {/* Removes only the list entry, never files; undo comes in the toast */}
                      <button className="button" onClick={() => void forget(v.id, v.name)}>
                        {t('vault.forget')}
                      </button>
                    </>
                  )}
                </div>
              )
            })}
            <div className="row actions">
              <button
                className="button"
                onClick={() =>
                  void invoke('vault:openDialog').then((st) => s().setVault(st), s().fail)
                }
              >
                {t('vault.add')}
              </button>
              <button
                className="button"
                onClick={() => void invoke('vault:create').then((st) => s().setVault(st), s().fail)}
              >
                {t('vault.create')}
              </button>
            </div>
          </div>
        </section>

        <section>
          <h3>{t('settings.shortcuts')}</h3>
          <div className="group">
            <div className="row">
              <div className="row-main">
                <div className="row-title">{t('settings.captureShortcut')}</div>
                <div className="row-sub">{t('settings.captureShortcutHint')}</div>
              </div>
              {settings && settings.captureShortcut !== DEFAULT_CAPTURE_SHORTCUT && (
                <button
                  className="button"
                  onClick={() => void update({ captureShortcut: DEFAULT_CAPTURE_SHORTCUT })}
                >
                  {t('settings.resetShortcut')}
                </button>
              )}
              {settings && (
                <ShortcutRecorder
                  value={settings.captureShortcut}
                  onChange={(captureShortcut) => void update({ captureShortcut })}
                />
              )}
            </div>
            <div className="row">
              <div className="row-main">
                <div className="row-title">{t('settings.allShortcutsTitle')}</div>
              </div>
              <button className="button" onClick={() => s().setSheet({ kind: 'shortcuts' })}>
                {t('settings.allShortcuts')}
              </button>
            </div>
          </div>
        </section>

        <section>
          <h3>{t('settings.data')}</h3>
          <div className="group">
            <div className="row">
              <div className="row-main">
                <div className="row-title">{t('settings.trashRetention')}</div>
                <div className="row-sub">{t('settings.trashRetentionHint')}</div>
              </div>
              {settings && (
                <select
                  value={trashWarning?.days ?? settings.trashRetentionDays}
                  onChange={(e) => void changeTrashRetention(Number(e.target.value))}
                  aria-label={t('settings.trashRetention')}
                >
                  {[7, 14, 30, 60, 90, 365, 0].map((d) => (
                    <option key={d} value={d}>
                      {d === 0 ? t('settings.never') : t('settings.days', { count: d })}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {trashWarning && (
              <div className="row warning" role="alert">
                <WarningIcon />
                <div className="row-main">
                  <div className="row-sub">
                    {t('settings.trashPurgeWarning', { count: trashWarning.count })}
                  </div>
                </div>
                <button className="button" onClick={() => setTrashWarning(null)}>
                  {t('common.cancel')}
                </button>
                <button
                  className="button danger"
                  onClick={() => {
                    const days = trashWarning.days
                    setTrashWarning(null)
                    void update({ trashRetentionDays: days })
                  }}
                >
                  {t('settings.trashPurgeConfirm')}
                </button>
              </div>
            )}
            <div className="row">
              <div className="row-main">
                <div className="row-title">{t('settings.historyRetention')}</div>
                <div className="row-sub">{t('settings.historyRetentionHint')}</div>
              </div>
              {settings && (
                <select
                  value={settings.historyRetentionDays}
                  onChange={(e) => void update({ historyRetentionDays: Number(e.target.value) })}
                  aria-label={t('settings.historyRetention')}
                >
                  <option value={0}>{t('settings.forever')}</option>
                  {[30, 90, 180].map((d) => (
                    <option key={d} value={d}>
                      {t('settings.months', { count: d / 30 })}
                    </option>
                  ))}
                  {[365, 730, 1825].map((d) => (
                    <option key={d} value={d}>
                      {t('settings.years', { count: d / 365 })}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </section>

        {/* Rarely needed: tuning and maintenance */}
        <section>
          <h3>{t('mcp.title')}</h3>
          <div className="group">
            <div className="row">
              <div className="row-main">
                <div className="row-title">{t('mcp.access')}</div>
                <div className="row-sub">{t('mcp.accessHint')}</div>
              </div>
              {settings && (
                <select
                  value={settings.mcpAccess}
                  onChange={(e) =>
                    void update({ mcpAccess: e.target.value as AppSettings['mcpAccess'] })
                  }
                  aria-label={t('mcp.access')}
                >
                  <option value="off">{t('mcp.off')}</option>
                  <option value="read">{t('mcp.read')}</option>
                  <option value="write">{t('mcp.write')}</option>
                </select>
              )}
            </div>
            {settings && settings.mcpAccess !== 'off' && <McpSetup />}
          </div>
          <p className="settings-note">
            {t('mcp.note')}{' '}
            <button className="link-button" onClick={() => void invoke('help:open', 'ai')}>
              {t('help.more')}
            </button>
          </p>
        </section>

        <section>
          <h3>{t('settings.advanced')}</h3>
          <div className="group">
            <div className="row">
              <div className="row-main">
                <div className="row-title">{t('settings.snapshotDelay')}</div>
                <div className="row-sub">{t('settings.snapshotDelayHint')}</div>
              </div>
              {settings && (
                <select
                  value={settings.snapshotDelayMs}
                  onChange={(e) => void update({ snapshotDelayMs: Number(e.target.value) })}
                  aria-label={t('settings.snapshotDelay')}
                >
                  {[2000, 4000, 10_000, 30_000, 60_000, 300_000].map((ms) => (
                    <option key={ms} value={ms}>
                      {ms < 60_000
                        ? t('settings.seconds', { count: ms / 1000 })
                        : t('settings.minutes', { count: ms / 60_000 })}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="row">
              <div className="row-main">
                <div className="row-title">{t('settings.index')}</div>
                <div className="row-sub">
                  {indexStatus.state === 'indexing'
                    ? t('sidebar.indexing', { done: indexStatus.done, total: indexStatus.total })
                    : t('settings.indexHint')}
                </div>
              </div>
              <button className="button" onClick={() => void invoke('app:revealPath', 'data')}>
                {t('settings.showInFinder')}
              </button>
              <button
                className="button"
                disabled={indexStatus.state === 'indexing'}
                onClick={() =>
                  void invoke('index:rebuild').then(
                    () => s().notify(t('settings.rebuildStarted')),
                    s().fail
                  )
                }
              >
                {t('settings.rebuild')}
              </button>
            </div>
          </div>
        </section>

        {/* Like any Mac app's "About": version, updates, where it comes from, what it sends */}
        <section>
          <h3>{t('about.title')}</h3>
          <div className="group">
            <div className="row">
              <div className="row-main">
                <div className="row-title">Write {paths?.version ?? ''}</div>
                <div className="row-sub">{t('about.license')}</div>
              </div>
              <button
                className="button"
                onClick={() => s().setSheet({ kind: 'whatsNew', since: null })}
              >
                {t('settings.whatsNew')}
              </button>
              <button className="button" onClick={() => void checkForUpdates()}>
                {t('settings.checkUpdates')}
              </button>
            </div>
            {settings && (
              <div className="row">
                <div className="row-main">
                  <div className="row-title" id="auto-updates-label">
                    {t('about.autoUpdates')}
                  </div>
                  <div className="row-sub">{t('about.autoUpdatesHint')}</div>
                </div>
                <input
                  type="checkbox"
                  role="switch"
                  className="switch"
                  aria-labelledby="auto-updates-label"
                  checked={settings.autoUpdates === 'on'}
                  onChange={(e) => void update({ autoUpdates: e.target.checked ? 'on' : 'off' })}
                />
              </div>
            )}
            <div className="row links">
              <a href={LINKS.repo} target="_blank" rel="noreferrer">
                {t('about.source')}
              </a>
              <a href={LINKS.issues} target="_blank" rel="noreferrer">
                {t('about.issues')}
              </a>
              <a href={LINKS.license} target="_blank" rel="noreferrer">
                {t('about.licenseLink')}
              </a>
              <button className="link-button" onClick={() => s().setSheet({ kind: 'licenses' })}>
                {t('about.thirdParty')}
              </button>
              <a href={LINKS.privacy} target="_blank" rel="noreferrer">
                {t('about.privacyLink')}
              </a>
              <a href={LINKS.impressum} target="_blank" rel="noreferrer">
                {t('about.impressum')}
              </a>
            </div>
          </div>
          <p className="settings-note">{t('about.privacy')}</p>
        </section>
      </div>
    </>
  )
}

const MOD_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift'])

/** Records a global shortcut: click, then press the combination. Esc cancels. */
function ShortcutRecorder({
  value,
  onChange
}: {
  value: string
  onChange(acc: string): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [recording, setRecording] = useState(false)
  // Says why a combination wasn't taken instead of silently ignoring it
  const [refused, setRefused] = useState(false)

  return (
    <button
      className={`shortcut-recorder ${recording ? 'recording' : ''} ${refused ? 'refused' : ''}`}
      aria-label={t('settings.captureShortcut')}
      onClick={() => {
        setRefused(false)
        setRecording(true)
      }}
      onBlur={() => {
        setRecording(false)
        setRefused(false)
      }}
      onKeyDown={(e) => {
        if (!recording) return
        e.preventDefault()
        e.stopPropagation()
        if (e.key === 'Escape') return setRecording(false)
        if (MOD_KEYS.has(e.key)) return
        const mods = [
          e.ctrlKey && 'Control',
          e.altKey && 'Alt',
          e.shiftKey && 'Shift',
          e.metaKey && 'Command'
        ].filter(Boolean)
        // A global shortcut needs at least one modifier besides Shift
        const key = codeToKey(e.code)
        if ((!e.ctrlKey && !e.altKey && !e.metaKey) || !key) {
          setRefused(false)
          requestAnimationFrame(() => setRefused(true))
          return
        }
        setRecording(false)
        onChange([...mods, key].join('+'))
      }}
    >
      {recording
        ? refused
          ? t('settings.needsModifier')
          : t('settings.pressKeys')
        : acceleratorGlyphs(value.replace('Command', 'CmdOrCtrl'), t('keys.spaceKey'))}
    </button>
  )
}

function codeToKey(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^F\d{1,2}$/.test(code)) return code
  const map: Record<string, string> = {
    Space: 'Space',
    Enter: 'Enter',
    Backspace: 'Backspace',
    Period: '.',
    Comma: ',',
    Slash: '/',
    Semicolon: ';',
    Quote: "'",
    BracketLeft: '[',
    BracketRight: ']',
    Minus: '-',
    Equal: '=',
    Backquote: '`'
  }
  return map[code] ?? null
}

/** Ready-to-paste setup for the common AI assistants, with this installation's paths. */
function McpSetup(): React.JSX.Element | null {
  const { t } = useTranslation()
  const [launch, setLaunch] = useState<McpLaunch | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  useEffect(() => {
    void invoke('mcp:launch').then(setLaunch, () => setLaunch(null))
  }, [])
  if (!launch) return null
  const server = { command: launch.command, args: launch.args, env: launch.env }
  const quote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`
  const snippets: { id: string; label: string; hint: string; text: string }[] = [
    {
      id: 'claude-code',
      label: 'Claude Code',
      hint: t('mcp.hintTerminal'),
      text: `claude mcp add write --scope user ${Object.entries(launch.env)
        .map(([k, v]) => `-e ${k}=${quote(v)}`)
        .join(' ')} -- ${[launch.command, ...launch.args].map(quote).join(' ')}`
    },
    {
      id: 'claude-desktop',
      label: 'Claude Desktop',
      hint: t('mcp.hintClaudeDesktop'),
      text: JSON.stringify({ mcpServers: { write: server } }, null, 2)
    },
    {
      id: 'opencode',
      label: 'OpenCode',
      hint: t('mcp.hintOpenCode'),
      text: JSON.stringify(
        {
          mcp: {
            write: {
              type: 'local',
              command: [launch.command, ...launch.args],
              environment: launch.env
            }
          }
        },
        null,
        2
      )
    }
  ]
  const copy = (id: string, text: string): void => {
    void invoke('clipboard:write', text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600)
    })
  }
  return (
    <>
      {snippets.map((sn) => (
        <div key={sn.id} className="row mcp-snippet">
          <div className="row-main">
            <div className="row-title">{sn.label}</div>
            <div className="row-sub">{sn.hint}</div>
            <pre>{sn.text}</pre>
          </div>
          <button className="button" onClick={() => copy(sn.id, sn.text)}>
            {copied === sn.id ? t('mcp.copied') : t('mcp.copy')}
          </button>
        </div>
      ))}
    </>
  )
}
