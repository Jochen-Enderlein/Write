import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PropKey } from '@shared/types'
import {
  PROP_TYPE_LIST,
  columnType,
  inferType,
  isEmpty,
  parseInput,
  valueText,
  type PropType,
  type PropValue
} from '@shared/properties'
import { dayKey } from '@shared/dates'
import { invoke } from '../api'
import { useStore } from '../store'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { PlusIcon } from './Icons'

export const PROP_TYPES = PROP_TYPE_LIST

/** What the field shows while not editing. */
function Display({ value, type }: { value: PropValue; type: PropType }): React.JSX.Element {
  const openByTitle = useStore((s) => s.openByTitle)
  if (isEmpty(value)) return <span className="prop-empty">—</span>
  if (type === 'list' || Array.isArray(value)) {
    const items = Array.isArray(value) ? value : [String(value)]
    return (
      <span className="prop-list">
        {items.map((v, i) => (
          <span key={i} className="prop-pill">
            {v}
          </span>
        ))}
      </span>
    )
  }
  if (type === 'link' && typeof value === 'string' && inferType(value) === 'link') {
    const target = valueText(value)
    return (
      <span
        className="wikilink"
        onMouseDown={(e) => {
          if (e.button !== 0) return
          e.preventDefault()
          e.stopPropagation()
          void openByTitle(target)
        }}
      >
        {target}
      </span>
    )
  }
  if (type === 'date' && typeof value === 'string') {
    const d = new Date(value.length === 10 ? value + 'T00:00' : value)
    if (!Number.isNaN(d.getTime()))
      return (
        <span>
          {d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          {value.length > 10 &&
            ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </span>
      )
  }
  return <span>{valueText(value)}</span>
}

/**
 * One property value: shows it, edits it in place on click. Checkboxes toggle directly.
 * `onChange(null)` clears the value.
 */
export function PropField({
  value,
  type,
  suggestions = [],
  readOnly = false,
  autoEdit = false,
  label,
  onChange,
  onDone
}: {
  value: PropValue
  type: PropType
  suggestions?: (string | number | boolean)[]
  readOnly?: boolean
  autoEdit?: boolean
  label: string
  onChange(v: PropValue): void
  /** Editing ended (also without a change). */
  onDone?(): void
}): React.JSX.Element {
  const [editing, setEditing] = useState(autoEdit)
  const listId = useId()
  const titles = useStore((s) => s.titles)

  if (type === 'checkbox') {
    return (
      <input
        type="checkbox"
        className="prop-check"
        aria-label={label}
        checked={value === true}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.checked)}
      />
    )
  }

  if (!editing || readOnly) {
    return (
      <button
        type="button"
        className="prop-value"
        aria-label={label}
        disabled={readOnly}
        onClick={() => setEditing(true)}
      >
        <Display value={value} type={type} />
      </button>
    )
  }

  const options =
    type === 'link'
      ? titles.slice(0, 2000).map((t) => t.title)
      : suggestions.map(String).filter((s, i, a) => a.indexOf(s) === i)
  const time = typeof value === 'string' && value.length > 10
  const initial =
    type === 'link' ? valueText(value) : Array.isArray(value) ? value.join(', ') : valueText(value)

  const commit = (raw: string): void => {
    setEditing(false)
    let next: PropValue
    if (type === 'date') next = raw ? (time ? raw.slice(0, 16) : raw) : null
    else next = parseInput(raw, type)
    if (JSON.stringify(next) !== JSON.stringify(value ?? null)) onChange(next)
    onDone?.()
  }

  return (
    <>
      <input
        autoFocus
        className="prop-input"
        aria-label={label}
        type={type === 'date' ? (time ? 'datetime-local' : 'date') : 'text'}
        inputMode={type === 'number' ? 'decimal' : undefined}
        defaultValue={type === 'date' ? String(value ?? '').replace(' ', 'T') : initial}
        list={options.length ? listId : undefined}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setEditing(false)
            onDone?.()
          }
        }}
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </>
  )
}

/** Type of a property: from its own value, else from what sibling pages store under that key. */
export function typeOf(value: PropValue | undefined, key?: PropKey): PropType {
  return inferType(value ?? null) ?? (key ? columnType(key.values) : 'text')
}

/** First value for a new property of the given type. */
function initialValue(type: PropType): PropValue {
  if (type === 'checkbox') return false
  if (type === 'date') return dayKey()
  return null
}

/**
 * The page's properties below the title: one row per frontmatter field, editable in place.
 * Keys and values of sibling pages are offered as suggestions.
 */
export function PropertyEditor({
  path,
  props,
  onChange
}: {
  path: string
  props: Record<string, PropValue>
  /** `undefined` removes the property. */
  onChange(changes: Record<string, PropValue | undefined>): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [keys, setKeys] = useState<PropKey[]>([])
  const [adding, setAdding] = useState(false)
  // A new property waits here until it gets a value (an empty one would be written as `""`)
  const [pending, setPending] = useState<{ key: string; type: PropType } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''

  useEffect(() => {
    let live = true
    void invoke('index:propKeys', folder).then(
      (k) => live && setKeys(k),
      () => undefined
    )
    return () => {
      live = false
    }
  }, [folder, props])

  const byKey = useMemo(() => new Map(keys.map((k) => [k.key, k])), [keys])
  const entries = Object.entries(props)

  const rename = (from: string, to: string): void => {
    setRenaming(null)
    const next = to.trim()
    if (!next || next === from || next in props) return
    onChange({ [from]: undefined, [next]: props[from] ?? null })
  }

  const openMenu = (e: React.MouseEvent, key: string): void => {
    e.preventDefault()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: t('props.rename'), onSelect: () => setRenaming(key) },
        { label: t('props.remove'), danger: true, onSelect: () => onChange({ [key]: undefined }) }
      ]
    })
  }

  return (
    <div className={`page-props ${entries.length || pending ? 'has-props' : ''}`}>
      {entries.map(([key, value]) => {
        const type = typeOf(value, byKey.get(key))
        return (
          <div className="prop-row" key={key}>
            {renaming === key ? (
              <input
                autoFocus
                className="prop-input prop-key-input"
                defaultValue={key}
                aria-label={t('props.rename')}
                onBlur={(e) => rename(key, e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setRenaming(null)
                }}
              />
            ) : (
              <button
                type="button"
                className="prop-key"
                title={t(`props.type.${type}`)}
                onClick={(e) => openMenu(e, key)}
                onContextMenu={(e) => openMenu(e, key)}
              >
                {key}
              </button>
            )}
            <PropField
              label={key}
              value={value}
              type={type}
              suggestions={byKey.get(key)?.values}
              onChange={(v) => onChange({ [key]: v === null ? undefined : v })}
            />
          </div>
        )
      })}
      {pending && (
        <div className="prop-row">
          <span className="prop-key">{pending.key}</span>
          <PropField
            label={pending.key}
            value={initialValue(pending.type)}
            type={pending.type}
            autoEdit
            suggestions={byKey.get(pending.key)?.values}
            onChange={(v) => {
              setPending(null)
              if (!isEmpty(v)) onChange({ [pending.key]: v })
            }}
            onDone={() => setPending(null)}
          />
        </div>
      )}
      {adding ? (
        <AddProperty
          existing={props}
          keys={keys}
          onCancel={() => setAdding(false)}
          onAdd={(key, type) => {
            setAdding(false)
            // A checkbox has a meaningful value right away; the others wait for input
            if (type === 'checkbox' || type === 'date') onChange({ [key]: initialValue(type) })
            else setPending({ key, type })
          }}
        />
      ) : (
        <button className="page-add-tag page-add-prop" onClick={() => setAdding(true)}>
          <PlusIcon size={12} />
          {t('props.add')}
        </button>
      )}
      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  )
}

/** Name field with suggestions from sibling pages, then a type choice for new keys. */
function AddProperty({
  existing,
  keys,
  onAdd,
  onCancel
}: {
  existing: Record<string, PropValue>
  keys: PropKey[]
  onAdd(key: string, type: PropType): void
  onCancel(): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [type, setType] = useState<PropType>('text')
  const listId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const known = keys.find((k) => k.key === name.trim())
  const free = keys.filter((k) => !(k.key in existing))

  const submit = (): void => {
    const key = name.trim()
    if (!key) return onCancel()
    if (key in existing || /^(id|title|icon|tags|created|updated)$/.test(key)) return
    onAdd(key, known ? columnType(known.values) : type)
  }

  return (
    <div
      className="prop-add"
      ref={ref}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) submit()
      }}
    >
      <input
        autoFocus
        className="prop-input"
        placeholder={t('props.namePlaceholder')}
        aria-label={t('props.add')}
        value={name}
        list={listId}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          } else if (e.key === 'Escape') onCancel()
        }}
      />
      <datalist id={listId}>
        {free.map((k) => (
          <option key={k.key} value={k.key} />
        ))}
      </datalist>
      {!known && (
        <select
          className="prop-type"
          aria-label={t('props.typeLabel')}
          value={type}
          onChange={(e) => setType(e.target.value as PropType)}
        >
          {PROP_TYPES.map((p) => (
            <option key={p} value={p}>
              {t(`props.type.${p}`)}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
