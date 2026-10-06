import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { entriesSince, parseChangelog, RELEASES_URL } from '@shared/changelog'
import changelog from '../../../../CHANGELOG.md?raw'
import { invoke } from '../api'
import { locale } from '../i18n'

/** `**fett**`, `Code` and `_kursiv_` inside a line of release notes. */
function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
    if (part.length > 2 && part.startsWith('_') && part.endsWith('_'))
      return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

/** The small Markdown subset the changelog uses: `###` headings, `-` lists, paragraphs. */
function Notes({ body }: { body: string }): React.JSX.Element {
  const blocks: React.ReactNode[] = []
  let list: string[] = []
  const flush = (): void => {
    if (!list.length) return
    blocks.push(
      <ul key={blocks.length}>
        {list.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>
    )
    list = []
  }
  for (const line of body.split('\n')) {
    const item = /^\s*[-*]\s+(.*)$/.exec(line)
    if (item) {
      list.push(item[1]!)
      continue
    }
    if (list.length && /^\s{2,}\S/.test(line)) {
      list[list.length - 1] += ' ' + line.trim()
      continue
    }
    flush()
    const h = /^#{3,}\s+(.*)$/.exec(line)
    if (h) blocks.push(<h4 key={blocks.length}>{inline(h[1]!)}</h4>)
    else if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line.trim())}</p>)
  }
  flush()
  return <div className="notes">{blocks}</div>
}

/**
 * "Neu in Write": after an update it lists every version since the one used last time; from the
 * Help menu it shows the whole history. The notes ship inside the app, so this works offline.
 */
export function WhatsNewSheet({
  since,
  onClose
}: {
  since: string | null
  onClose(): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => {
    void invoke('app:paths').then((p) => setVersion(p.version))
  }, [])
  const entries = useMemo(
    () => (version ? entriesSince(parseChangelog(changelog), since, version) : []),
    [since, version]
  )

  return (
    <>
      <div className="sheet-header">
        <h2>{since && version ? t('whatsNew.titleUpdated', { version }) : t('whatsNew.title')}</h2>
        <button className="button primary" onClick={onClose}>
          {since ? t('whatsNew.continue') : t('common.done')}
        </button>
      </div>
      <div className="whats-new">
        {version && entries.length === 0 && (
          <p className="whats-new-empty">{t('whatsNew.none', { version })}</p>
        )}
        {entries.map((e) => (
          <section key={e.version} className="release">
            <h3>
              {t('whatsNew.version', { version: e.version })}
              {e.date && <span className="release-date">{formatDay(e.date)}</span>}
            </h3>
            <Notes body={e.body} />
          </section>
        ))}
        <p className="whats-new-footer">
          <a href={RELEASES_URL} target="_blank" rel="noreferrer">
            {t('whatsNew.allReleases')}
          </a>
        </p>
      </div>
    </>
  )
}

/** `2026-10-06` → „6. Oktober 2026“ in the app's language. */
function formatDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'long' }).format(
    new Date(iso + 'T12:00:00')
  )
}
