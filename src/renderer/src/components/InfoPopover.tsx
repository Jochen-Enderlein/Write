import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { readHeader } from '@shared/page'
import { tagsField } from '@shared/frontmatter'
import { invoke } from '../api'
import { formatDate } from '../lib/hooks'
import { locale } from '../i18n'
import { useStore } from '../store'

/** Page details anchored to the toolbar's info button; it grows out of that button. */
export function InfoPopover({ path }: { path: string }): React.JSX.Element {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 56, right: 16 })
  const [info, setInfo] = useState<{
    id: string | null
    created: string
    updated: string
    tags: string[]
    backlinks: number
  } | null>(null)
  const editor = useStore((s) => s.editor)
  const setInfoOpen = useStore((s) => s.setInfoOpen)

  useLayoutEffect(() => {
    const btn = document.getElementById('info-button')
    if (!btn) return
    const r = btn.getBoundingClientRect()
    setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
  }, [])

  useEffect(() => {
    void (async () => {
      await editor?.flush()
      const [file, backlinks] = await Promise.all([
        invoke('page:read', path),
        invoke('index:backlinks', path)
      ])
      const h = readHeader(path, file.text)
      setInfo({
        id: h.id,
        created: String(h.data.created ?? ''),
        updated: String(h.data.updated ?? ''),
        tags: tagsField(h.data),
        backlinks: backlinks.length
      })
    })()
  }, [path, editor])

  useEffect(() => {
    const close = (e: Event): void => {
      if (
        ref.current?.contains(e.target as Node) ||
        (e.target as HTMLElement).closest?.('#info-button')
      )
        return
      setInfoOpen(false)
    }
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setInfoOpen(false)
    }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', key)
    }
  }, [setInfoOpen])

  return (
    <div
      ref={ref}
      className="popover glass"
      role="dialog"
      aria-label={t('info.title')}
      style={{ top: pos.top, right: pos.right, transformOrigin: 'top right' }}
    >
      <h3>{t('info.title')}</h3>
      <dl>
        <dt>{t('info.path')}</dt>
        <dd>{path}</dd>
        {info?.id && (
          <>
            <dt>{t('info.id')}</dt>
            <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{info.id}</dd>
          </>
        )}
        {info?.created && (
          <>
            <dt>{t('info.created')}</dt>
            <dd>{formatDate(info.created)}</dd>
          </>
        )}
        {info?.updated && (
          <>
            <dt>{t('info.updated')}</dt>
            <dd>{formatDate(info.updated)}</dd>
          </>
        )}
        {info && info.tags.length > 0 && (
          <>
            <dt>{t('info.tags')}</dt>
            <dd>{info.tags.map((x) => '#' + x).join(' ')}</dd>
          </>
        )}
        <dt>{t('info.words')}</dt>
        <dd>{editor?.stats().words.toLocaleString(locale()) ?? '–'}</dd>
        <dt>{t('info.backlinks')}</dt>
        <dd>{info?.backlinks ?? '–'}</dd>
      </dl>
    </div>
  )
}
