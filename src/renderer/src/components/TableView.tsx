import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TableRow, TaskRow } from '@shared/types'
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
import { dayKey } from '@shared/dates'
import { useStore } from '../store'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { DocIcon, PlusIcon } from './Icons'
import { PROP_TYPES, PropField } from './Properties'

/** Rows rendered at once; more on request, so huge folders stay responsive. */
const PAGE = 300

/** Where the rows come from: the pages of a folder, or the to-dos of the whole vault. */
export type TableSource = { kind: 'folder'; folder: string } | { kind: 'tasks' }

/** Columns of the tasks table; fixed, the text is the title column. */
const TASK_KEYS = ['done', 'due', 'page'] as const
const TASK_TYPES: Record<string, PropType> = { done: 'checkbox', due: 'date', page: 'link' }

interface Row {
  /** Unique per row: the page path, or `path#line` for a to-do. */
  id: string
  /** The page the row opens. */
  path: string
  title: string
  icon: string | null
  tags: string[]
  props: Record<string, PropValue>
  task?: TaskRow
}

function fromPage(r: TableRow): Row {
  return { id: r.path, path: r.path, title: r.title, icon: r.icon, tags: r.tags, props: r.props }
}

function fromTask(t: TaskRow): Row {
  return {
    id: `${t.path}#${t.line}`,
    path: t.path,
    title: t.text,
    icon: null,
    tags: [],
    props: { done: t.done, due: t.due, page: `[[${t.pageTitle}]]` },
    task: t
  }
}

/** A table cell also shows tags (stored in their own frontmatter field). */
function valueOf(row: Row, key: string): PropValue {
  if (key === 'tags') return row.tags
  return row.props[key] ?? null
}

/**
 * The pages directly inside a folder as a table, one column per property – or every to-do of
 * the vault. Cells edit the page's frontmatter (or the to-do's line); sorting, filters and
 * visible columns live in `config`.
 */
export function TableView({
  source,
  config,
  onConfig,
  compact = false
}: {
  source: TableSource
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

  const isTasks = source.kind === 'tasks'
  const folder = source.kind === 'folder' ? source.folder : ''
  const load = useCallback(() => {
    const req: Promise<Row[]> = isTasks
      ? invoke('index:tasks').then((ts) => ts.map(fromTask))
      : invoke('index:table', folder).then((ps) => ps.map(fromPage))
    void req.then(setRows, () => setRows([]))
  }, [folder, isTasks])
  useEffect(load, [load])
  useIpcEvent('index:updated', load)

  const allKeys = useMemo(
    () => (isTasks ? [...TASK_KEYS] : rows ? columnKeys(rows) : []),
    [rows, isTasks]
  )
  // To-dos are checked off before their text, so a done column would show the box twice
  const columns = useMemo(
    () => config.columns ?? (isTasks ? allKeys.filter((k) => k !== 'done') : allKeys),
    [config.columns, allKeys, isTasks]
  )
  const types = useMemo(() => {
    const m = new Map<string, PropType>()
    for (const key of columns) {
      const values = (rows ?? []).map((r) => valueOf(r, key))
      const hint = config.types?.[key]
      m.set(
        key,
        isTasks
          ? (TASK_TYPES[key] ?? 'text')
          : key === 'tags'
            ? 'list'
            : hint && values.every((v) => v === null || v === '')
              ? hint
              : columnType(values)
      )
    }
    return m
  }, [columns, rows, config.types, isTasks])
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
        r.id !== row.id
          ? r
          : r.task && key === 'done'
            ? {
                ...r,
                props: { ...r.props, done: value },
                task: { ...r.task, done: value === true }
              }
            : key === 'tags'
              ? { ...r, tags: Array.isArray(value) ? value : [] }
              : { ...r, props: { ...r.props, [key]: value } }
      )
    )
    try {
      if (row.task) {
        const change =
          key === 'done'
            ? { done: value === true }
            : { due: typeof value === 'string' && value ? value.slice(0, 10) : null }
        await invoke('page:updateTask', row.path, row.task.line, row.task.text, change)
      } else await invoke('page:setProps', row.path, { [key]: value })
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

  const colName = (key: string): string =>
    key === 'tags'
      ? t('table.tags')
      : isTasks && (TASK_KEYS as readonly string[]).includes(key)
        ? t(`tasks.${key}`)
        : key
  const titleName = isTasks ? t('tasks.task') : t('table.title')
  // Checkbox filters read as words, not as `true`/`false`
  const filterValueLabel = (v: string | undefined): string =>
    v === 'true' ? t('table.yes') : v === 'false' ? t('table.no') : (v ?? '')

  const columnsMenu = (e: React.MouseEvent): void => {
    const hidden = [...allKeys, ...(isTasks ? [] : ['tags'])].filter((k) => !columns.includes(k))
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        ...hidden.map((k) => ({
          label: t('table.show', { name: colName(k) }),
          onSelect: () => onConfig({ ...config, columns: [...columns, k] })
        })),
        ...(isTasks
          ? []
          : [
              {
                label: t('table.newColumn'),
                separatorBefore: hidden.length > 0,
                onSelect: () => setNewColumn(true)
              }
            ]),
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

  const sort = config.sort?.[0]
  const today = dayKey()

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
            {f.key === 'title' ? titleName : colName(f.key)} {t(`table.op.${f.op}`)}{' '}
            {filterValueLabel(f.value)} ✕
          </button>
        ))}
        {sort && (
          <button
            className="chip"
            title={t('table.removeSort')}
            onClick={() => onConfig({ ...config, sort: undefined })}
          >
            {sort.key === 'title' ? titleName : colName(sort.key)} {sort.dir === 'asc' ? '↑' : '↓'}{' '}
            ✕
          </button>
        )}
        <button
          className="chip"
          onClick={() => setFilterDraft({ key: columns[0] ?? 'title', op: 'is', value: '' })}
        >
          {t('table.addFilter')}
        </button>
        <span className="db-count">
          {t(isTasks ? 'tasks.count' : 'table.count', { count: shown.length })}
        </span>
        <button className="chip" onClick={columnsMenu}>
          {t('table.columns')}
        </button>
      </div>

      {filterDraft && (
        <FilterForm
          draft={filterDraft}
          keys={['title', ...columns]}
          types={types}
          colName={(k) => (k === 'title' ? titleName : colName(k))}
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
                {titleName}
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
              <tr key={row.id} className={row.task?.done ? 'done' : undefined}>
                <th scope="row">
                  {row.task && (
                    // Checking off right before the text, like in a to-do list
                    <PropField
                      label={`${row.title}: ${t('tasks.done')}`}
                      value={row.task.done}
                      type="checkbox"
                      onChange={(v) => void setCell(row, 'done', v)}
                    />
                  )}
                  <button className="db-title" onClick={() => openPage(row.path)}>
                    {!row.task && (
                      <span className="db-icon" aria-hidden="true">
                        {row.icon ?? <DocIcon size={14} />}
                      </span>
                    )}
                    {row.title}
                  </button>
                </th>
                {columns.map((key) => (
                  <td
                    key={key}
                    className={
                      row.task &&
                      key === 'due' &&
                      !row.task.done &&
                      row.task.due &&
                      row.task.due < today
                        ? 'overdue'
                        : undefined
                    }
                  >
                    {row.task && key === 'page' ? (
                      // The page a to-do is on; read-only, opens the page
                      <button className="db-title db-page" onClick={() => openPage(row.path)}>
                        {row.task.pageIcon && (
                          <span className="db-icon" aria-hidden="true">
                            {row.task.pageIcon}
                          </span>
                        )}
                        {row.task.pageTitle}
                      </button>
                    ) : (
                      <PropField
                        label={`${row.title}: ${colName(key)}`}
                        value={valueOf(row, key)}
                        type={types.get(key) ?? 'text'}
                        suggestions={suggestions.get(key)}
                        onChange={(v) => void setCell(row, key, v)}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="db-empty">
            {rows.length ? t('table.noMatch') : isTasks ? t('tasks.empty') : t('table.empty')}
          </p>
        )}
      </div>

      {shown.length > limit && (
        <button className="button small db-more" onClick={() => setLimit((l) => l + PAGE)}>
          {t('table.more', { count: shown.length - limit })}
        </button>
      )}
      {isTasks ? null : creating ? (
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
