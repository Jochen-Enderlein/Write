import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../store'
import { CloseIcon, PlusIcon } from './Icons'

/** Frontmatter tags as chips below the title, with autocomplete from all tags in the vault. */
export function TagEditor({
  tags,
  onChange
}: {
  tags: string[]
  onChange(tags: string[]): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const all = useStore((s) => s.tags)
  const navigate = useStore((s) => s.navigate)
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')

  const suggestions = useMemo(() => {
    const q = value.trim().replace(/^#/, '').toLowerCase()
    if (!q) return []
    return all
      .map((x) => x.tag)
      .filter((tag) => tag.includes(q) && !tags.includes(tag))
      .slice(0, 6)
  }, [all, value, tags])

  const add = (raw: string): void => {
    const tag = raw
      .trim()
      .replace(/^#/, '')
      .replace(/[\s,;]+/g, '-')
      .toLowerCase()
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
    setValue('')
  }

  return (
    <div className={`page-tags ${tags.length ? 'has-tags' : ''}`}>
      {tags.map((tag) => (
        <span key={tag} className="chip tag-chip">
          <button className="tag-name" onClick={() => navigate({ kind: 'search', query: '', tag })}>
            #{tag}
          </button>
          <button
            className="tag-remove"
            aria-label={t('page.removeTag', { tag })}
            title={t('page.removeTag', { tag })}
            onClick={() => onChange(tags.filter((x) => x !== tag))}
          >
            <CloseIcon size={11} />
          </button>
        </span>
      ))}
      {adding ? (
        <span className="tag-input-wrap">
          <input
            autoFocus
            className="tag-input"
            value={value}
            placeholder={t('page.tagPlaceholder')}
            aria-label={t('page.addTag')}
            list="tag-suggestions"
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => {
              add(value)
              setAdding(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                add(value)
              } else if (e.key === 'Escape') {
                setValue('')
                setAdding(false)
              } else if (e.key === 'Backspace' && !value && tags.length) {
                onChange(tags.slice(0, -1))
              }
            }}
          />
          <datalist id="tag-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </span>
      ) : (
        <button className="page-add-tag" onClick={() => setAdding(true)}>
          <PlusIcon size={12} />
          {t('page.addTag')}
        </button>
      )}
    </div>
  )
}
