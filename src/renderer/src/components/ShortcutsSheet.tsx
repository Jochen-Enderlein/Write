import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COMMANDS, EDITOR_SHORTCUTS, acceleratorGlyphs, type CommandDef } from '@shared/keymap'
import { invoke } from '../api'
import { SearchIcon } from './Icons'

const GROUPS: CommandDef['menu'][] = ['file', 'edit', 'page', 'go', 'view', 'app', 'help']

/** Every shortcut in one place, generated from the same keymap the menu bar uses. */
export function ShortcutsSheet({ onClose }: { onClose(): void }): React.JSX.Element {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [capture, setCapture] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
    void invoke('settings:get').then((s) => setCapture(s.captureShortcut))
  }, [])

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (label: string): boolean => !q || label.toLowerCase().includes(q)
    const out: { title: string; rows: { label: string; keys: string }[] }[] = []
    out.push({
      title: t('keys.editor'),
      rows: EDITOR_SHORTCUTS.map((s) => ({ label: t(s.label), keys: s.keys })).filter((r) =>
        match(r.label)
      )
    })
    if (capture)
      out.push({
        title: t('keys.global'),
        rows: [{ label: t('keys.captureGlobal'), keys: capture }].filter((r) => match(r.label))
      })
    for (const g of GROUPS) {
      out.push({
        title: t(`keys.${g}`),
        rows: COMMANDS.filter((c) => c.menu === g && c.accelerator)
          .map((c) => ({ label: t(c.label).replace(/ …$/, ''), keys: c.accelerator! }))
          .filter((r) => match(r.label))
      })
    }
    return out.filter((s) => s.rows.length > 0)
  }, [query, capture, t])

  return (
    <>
      <div className="sheet-header">
        <h2>{t('keys.title')}</h2>
        <label className="search-field compact">
          <SearchIcon size={14} />
          <input
            ref={input}
            value={query}
            placeholder={t('keys.search')}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className="button" onClick={onClose}>
          {t('common.done')}
        </button>
      </div>
      <div className="shortcuts">
        {sections.length === 0 && <p className="lead">{t('keys.none')}</p>}
        {sections.map((s) => (
          <section key={s.title}>
            <h3>{s.title}</h3>
            {s.rows.map((r) => (
              <div key={r.label} className="shortcut-row">
                <span>{r.label}</span>
                <kbd>
                  {acceleratorGlyphs(r.keys.replace(/^Command/, 'CmdOrCtrl'), t('keys.spaceKey'))}
                </kbd>
              </div>
            ))}
          </section>
        ))}
      </div>
    </>
  )
}
