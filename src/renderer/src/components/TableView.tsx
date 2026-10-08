import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TableRow } from '@shared/types'
import {
  FILTER_OPS,
  applyTable,
  columnKeys,
  columnType,
  type FilterOp,
  type PropType,
  type PropValue,
  type TableConfig,
  type TableFilter
} from '@shared/properties'
import { invoke } from '../api'
import { useIpcEvent } from '../lib/hooks'
import { useStore } from '../store'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { DocIcon, PlusIcon } from './Icons'
import { PROP_TYPES, PropField } from './Properties'

/** Rows rendered at once; more on request, so huge folders stay responsive. */
const PAGE = 300

type Row = TableRow & { props: Record<string, PropValue> }

/** A table cell also shows tags (stored in their own frontmatter field). */
function valueOf(row: Row, key: string): PropValue {
  if (key === 'tags') return row.tags
  return row.props[key] ?? null
}

/**
 * The pages directly inside `folder` as a table: one column per property. Cells edit the
 * page's frontmatter; sorting, filters and visible columns live in `config`.
 */
export function TableView({
  folder,
  config,
  onConfig,
  compact = false
}: {
  folder: string
  config: TableConfig
  onConfig(next: TableConfig): void
  /** Inside a page: no sticky header, smaller toolbar. */
  compact?: boolean
}): React.JSX.Element {
  const { t } = useTranslation()
  const openPage = useStore((s) => s.openPage)
  const fail = useStore((s) => s.fail)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [limit, setLimit] = useState(PAGE)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const [filterDraft, setFilterDraft] = useState<TableFilter | null>(null)
  const [newColumn, setNewColumn] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    void invoke('index:table', folder).then(setRows, () => setRows([]))
  }, [folder])
  useEffect(load, [load])
  useIpcEvent('index:updated', load)

  const allKeys = useMemo(() => (rows ? columnKeys(rows) : []), [rows])
  const columns = useMemo(() => config.columns ?? allKeys, [config.columns, allKeys])
  const types = useMemo(() => {
    const m = new Map<string, PropType>()
    for (const key of columns) {
      const values = (rows ?? []).map((r) => valueOf(r, key))
      const hint = config.types?.[key]
      m.set(
        key,
        key === 'tags'
          ? 'list'
          : hint && values.every((v) => v === null || v === '')
            ? hint
            : columnType(values)
      )
    }
    return m
  }, [columns, rows, config.types])
  const suggestions = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const key of columns) {
      const set = new Set<string>()
      for (const r of rows ?? []) {
        const v = valueOf(r, key)
        for (const x of Array.isArray(v) ? v : v === null ? [] : [v]) set.add(String(x))
        if (set.size > 40) break
      }
      m.set(key, [...set])
    }
    return m
  }, [columns, rows])
  const shown = useMemo(
    () =>
      rows
        ? applyTable(
            rows.map((r) => ({ ...r, props: { ...r.props, tags: r.tags } })),
            config
          )
        : [],
    [rows, config]
  )

  const setCell = async (row: Row, key: string, value: PropValue): Promise<void> => {
    // Optimistic: the index catches up a moment later and confirms
    setRows((rs) =>
      (rs ?? []).map((r) =>
        r.path !== row.path
          ? r
          : key === 'tags'
            ? { ...r, tags: Array.isArray(value) ? value : [] }
            : { ...r, props: { ...r.props, [key]: value } }
      )
    )
    try {
      await invoke('page:setProps', row.path, { [key]: value })
    } catch (err) {
      fail(err)
      load()
    }
  }

  const columnMenu = (e: React.MouseEvent, key: string): void => {
    e.preventDefault()
    const sortBy = (dir: 'asc' | 'desc'): void => onConfig({ ...config, sort: [{ key, dir }] })
    const items: MenuItem[] = [
      { label: t('table.sortAsc'), onSelect: () => sortBy('asc') },
      { label: t('table.sortDesc'), onSelect: () => sortBy('desc') },
      { label: t('table.filter'), onSelect: () => setFilterDraft({ key, op: 'is', value: '' }) }
    ]
    if (key !== 'title')
      items.push({
        label: t('table.hide'),
        separatorBefore: true,
        onSelect: () => onConfig({ ...config, columns: columns.filter((c) => c !== key) })
      })
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  const columnsMenu = (e: React.MouseEvent): void => {
    const hidden = [...allKeys, 'tags'].filter((k) => !columns.includes(k))
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        ...hidden.map((k) => ({
          label: t('table.show', { name: k === 'tags' ? t('table.tags') : k }),
          onSelect: () => onConfig({ ...config, columns: [...columns, k] })
        })),
        {
          label: t('table.newColumn'),
          separatorBefore: hidden.length > 0,
          onSelect: () => setNewColumn(true)
        },
        ...(config.columns
          ? [
              {
                label: t('table.showAll'),
                onSelect: () => onConfig({ ...config, columns: undefined })
              }
            ]
          : [])
      ]
    })
  }

  const colName = (key: string): string => (key === 'tags' ? t('table.tags') : key)
  const sort = config.sort?.[0]

  if (rows === null)
    return <div className={`db-table ${compact ? 'compact' : ''}`} aria-busy="true" />

  return (
    <div className={`db-table ${compact ? 'compact' : ''}`}>
      <div className="db-toolbar">
        {(config.filter ?? []).map((f, i) => (
          <button
            key={i}
            className="chip active"
            title={t('table.removeFilter')}
            onClick={() =>
              onConfig({ ...config, filter: (config.filter ?? []).filter((_, j) => j !== i) })
            }
          >
            {colName(f.key)} {t(`table.op.${f.op}`)} {f.value ?? ''} ✕
          </button>
        ))}
        {sort && (
          <button
            className="chip"
            title={t('table.removeSort')}
            onClick={() => onConfig({ ...config, sort: undefined })}
          >
            {sort.key === 'title' ? t('table.title') : colName(sort.key)}{' '}
            {sort.dir === 'asc' ? '↑' : '↓'} ✕
          </button>
        )}
        <button
          className="chip"
          onClick={() => setFilterDraft({ key: columns[0] ?? 'title', op: 'is', value: '' })}
        >
          {t('table.addFilter')}
        </button>
        <span className="db-count">{t('table.count', { count: shown.length })}</span>
        <button className="chip" onClick={columnsMenu}>
          {t('table.columns')}
        </button>
      </div>

      {filterDraft && (
        <FilterForm
          draft={filterDraft}
          keys={['title', ...columns]}
          types={types}
          colName={(k) => (k === 'title' ? t('table.title') : colName(k))}
          onCancel={() => setFilterDraft(null)}
          onSubmit={(f) => {
            setFilterDraft(null)
            onConfig({ ...config, filter: [...(config.filter ?? []), f] })
          }}
        />
      )}
      {newColumn && (
        <NewColumn
          taken={columns}
          onCancel={() => setNewColumn(false)}
          onSubmit={(key, type) => {
            setNewColumn(false)
            onConfig({
              ...config,
              columns: [...columns, key],
              types: { ...(config.types ?? {}), [key]: type }
            })
          }}
        />
      )}

      <div className="db-scroll">
        <table>
          <thead>
            <tr>
              <th
                scope="col"
                onClick={(e) => columnMenu(e, 'title')}
                onContextMenu={(e) => columnMenu(e, 'title')}
              >
                {t('table.title')}
              </th>
              {columns.map((key) => (
                <th
                  key={key}
                  scope="col"
                  title={t(`props.type.${types.get(key) ?? 'text'}`)}
                  onClick={(e) => columnMenu(e, key)}
                  onContextMenu={(e) => columnMenu(e, key)}
                >
                  {colName(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, limit).map((row) => (
              <tr key={row.path}>
                <th scope="row">
                  <button className="db-title" onClick={() => openPage(row.path)}>
                    <span className="db-icon" aria-hidden="true">
                      {row.icon ?? <DocIcon size={14} />}
                    </span>
                    {row.title}
                  </button>
                </th>
                {columns.map((key) => (
                  <td key={key}>
                    <PropField
                      label={`${row.title}: ${colName(key)}`}
                      value={valueOf(row, key)}
                      type={types.get(key) ?? 'text'}
                      suggestions={suggestions.get(key)}
                      onChange={(v) => void setCell(row, key, v)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="db-empty">{rows.length ? t('table.noMatch') : t('table.empty')}</p>
        )}
      </div>

      {shown.length > limit && (
        <button className="button small db-more" onClick={() => setLimit((l) => l + PAGE)}>
          {t('table.more', { count: shown.length - limit })}
        </button>
      )}
      {creating ? (
        <input
          autoFocus
          className="prop-input db-new-input"
          placeholder={t('table.newPlaceholder')}
          aria-label={t('table.new')}
          onBlur={(e) => {
            const title = e.currentTarget.value.trim()
            setCreating(false)
            if (title) void invoke('page:create', folder, title).catch(fail)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              e.currentTarget.value = ''
              e.currentTarget.blur()
            }
          }}
        />
      ) : (
        <button className="db-new" onClick={() => setCreating(true)}>
          <PlusIcon size={12} />
          {t('table.new')}
        </button>
      )}
      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  )
}

/** Relative dates offered for date columns; resolved against today whenever the table shows. */
const RELATIVE_DATES = ['heute', 'morgen', 'gestern', 'heute+7', 'heute-7', 'heute+30']

function FilterForm({
  draft,
  keys,
  types,
  colName,
  onSubmit,
  onCancel
}: {
  draft: TableFilter
  keys: string[]
  types: Map<string, PropType>
  colName(k: string): string
  onSubmit(f: TableFilter): void
  onCancel(): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [f, setF] = useState(draft)
  const needsValue = f.op !== 'empty' && f.op !== 'notEmpty'
  const isDate = types.get(f.key) === 'date'
  const listId = useId()
  return (
    <form
      className="db-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(needsValue ? f : { key: f.key, op: f.op })
      }}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <select
        aria-label={t('table.filterColumn')}
        value={f.key}
        onChange={(e) => setF({ ...f, key: e.target.value })}
      >
        {keys.map((k) => (
          <option key={k} value={k}>
            {colName(k)}
          </option>
        ))}
      </select>
      <select
        aria-label={t('table.filterOp')}
        value={f.op}
        onChange={(e) => setF({ ...f, op: e.target.value as FilterOp })}
      >
        {FILTER_OPS.map((op) => (
          <option key={op} value={op}>
            {t(`table.op.${op}`)}
          </option>
        ))}
      </select>
      {needsValue && (
        <input
          autoFocus
          className="prop-input"
          aria-label={t('table.filterValue')}
          placeholder={isDate ? t('table.relativeHint') : undefined}
          list={isDate ? listId : undefined}
          value={f.value ?? ''}
          onChange={(e) => setF({ ...f, value: e.target.value })}
        />
      )}
      {needsValue && isDate && (
        <datalist id={listId}>
          {RELATIVE_DATES.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      )}
      <button className="button small primary" type="submit">
        {t('table.apply')}
      </button>
      <button className="button small" type="button" onClick={onCancel}>
        {t('common.cancel')}
      </button>
    </form>
  )
}

function NewColumn({
  taken,
  onSubmit,
  onCancel
}: {
  taken: string[]
  onSubmit(key: string, type: PropType): void
  onCancel(): void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [type, setType] = useState<PropType>('text')
  const key = name.trim()
  const invalid = !key || taken.includes(key) || /^(id|title|icon|created|updated)$/.test(key)
  return (
    <form
      className="db-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!invalid) onSubmit(key, type)
      }}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <input
        autoFocus
        className="prop-input"
        placeholder={t('props.namePlaceholder')}
        aria-label={t('table.newColumn')}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
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
      <button className="button small primary" type="submit" disabled={invalid}>
        {t('table.apply')}
      </button>
      <button className="button small" type="button" onClick={onCancel}>
        {t('common.cancel')}
      </button>
    </form>
  )
}
