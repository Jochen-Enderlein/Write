/**
 * Page properties: every frontmatter field except the ones the app manages itself. There is no
 * schema – a property's type is read from its values, so files edited elsewhere just work.
 */

/** Frontmatter fields the app writes on its own; never shown as editable properties. */
export const RESERVED_KEYS = new Set(['id', 'title', 'icon', 'tags', 'created', 'updated'])

/** Columns a table can show besides properties; read-only except `tags`. */
export const BUILTIN_COLUMNS = ['tags', 'created', 'updated'] as const

export type PropType = 'checkbox' | 'number' | 'date' | 'link' | 'list' | 'text'
export const PROP_TYPE_LIST: PropType[] = ['text', 'number', 'date', 'checkbox', 'link', 'list']
export type PropValue = string | number | boolean | string[] | null

const DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/
const LINK_RE = /^\[\[[^\]]+\]\]$/

/** The frontmatter fields shown as properties, with values reduced to what a cell can hold. */
export function propertiesOf(data: Record<string, unknown>): Record<string, PropValue> {
  const out: Record<string, PropValue> = {}
  for (const [k, v] of Object.entries(data)) {
    if (RESERVED_KEYS.has(k)) continue
    out[k] = toPropValue(v)
  }
  return out
}

export function toPropValue(v: unknown): PropValue {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x)))
  return JSON.stringify(v)
}

export function inferType(v: PropValue): PropType | null {
  if (v === null || v === '') return null
  if (typeof v === 'boolean') return 'checkbox'
  if (typeof v === 'number') return 'number'
  if (Array.isArray(v)) return 'list'
  if (DATE_RE.test(v)) return 'date'
  if (LINK_RE.test(v.trim())) return 'link'
  return 'text'
}

/** Most common type among a column's values; `text` for an empty column. */
export function columnType(values: PropValue[]): PropType {
  const counts = new Map<PropType, number>()
  for (const v of values) {
    const t = inferType(v)
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  let best: PropType = 'text'
  let n = 0
  for (const [t, c] of counts) if (c > n) [best, n] = [t, c]
  return best
}

export function isEmpty(v: PropValue | undefined): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
}

const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' })

/** Text a value sorts and filters by. */
export function valueText(v: PropValue | undefined): string {
  if (isEmpty(v)) return ''
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  const s = String(v)
  return LINK_RE.test(s.trim()) ? s.trim().slice(2, -2).split('|')[0]! : s
}

/** Ascending order for one column; empty values always come last, whatever the direction. */
export function compareValues(a: PropValue | undefined, b: PropValue | undefined): number {
  const ea = isEmpty(a)
  const eb = isEmpty(b)
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return collator.compare(valueText(a), valueText(b))
}

export type FilterOp = 'is' | 'isNot' | 'contains' | 'empty' | 'notEmpty' | 'before' | 'after'
export const FILTER_OPS: FilterOp[] = [
  'is',
  'isNot',
  'contains',
  'empty',
  'notEmpty',
  'before',
  'after'
]

export interface TableFilter {
  key: string
  op: FilterOp
  value?: string
}

export interface TableSort {
  key: string
  dir: 'asc' | 'desc'
}

/** How a table shows its rows; stored in vault.json (folder view) or in a `write-table` block. */
export interface TableConfig {
  /** Visible columns besides the title, in order; unset shows every property. */
  columns?: string[]
  /** Type of columns that have no values yet to infer it from. */
  types?: Record<string, PropType>
  sort?: TableSort[]
  filter?: TableFilter[]
}

/** Case-insensitive comparison; `is` on a list means "contains this entry". */
export function matchesFilter(v: PropValue | undefined, f: TableFilter): boolean {
  const want = (f.value ?? '').trim().toLowerCase()
  const text = valueText(v).toLowerCase()
  const equal = Array.isArray(v) ? v.some((x) => x.toLowerCase() === want) : text === want
  switch (f.op) {
    case 'empty':
      return isEmpty(v)
    case 'notEmpty':
      return !isEmpty(v)
    case 'is':
      return equal
    case 'isNot':
      return !equal
    case 'contains':
      return text.includes(want)
    case 'before':
    case 'after': {
      if (isEmpty(v) || !want) return false
      const c =
        typeof v === 'number' && !Number.isNaN(Number(want))
          ? v - Number(want)
          : collator.compare(text, want)
      return f.op === 'before' ? c < 0 : c > 0
    }
  }
}

export interface Row {
  path: string
  title: string
  props: Record<string, PropValue>
}

/** Value of a column for a row; `title` is the page title. */
export function cellValue(row: Row, key: string): PropValue | undefined {
  return key === 'title' ? row.title : row.props[key]
}

export function applyTable<R extends Row>(rows: R[], cfg: TableConfig): R[] {
  const filters = cfg.filter ?? []
  const out = rows.filter((r) => filters.every((f) => matchesFilter(cellValue(r, f.key), f)))
  const sorts = cfg.sort?.length ? cfg.sort : [{ key: 'title', dir: 'asc' as const }]
  return out.sort((a, b) => {
    for (const s of sorts) {
      const va = cellValue(a, s.key)
      const vb = cellValue(b, s.key)
      let c = compareValues(va, vb)
      // Empty stays last in both directions
      if (c !== 0 && !isEmpty(va) && !isEmpty(vb) && s.dir === 'desc') c = -c
      if (c !== 0) return c
    }
    return 0
  })
}

/** Every property key used by the rows, in order of first appearance. */
export function columnKeys(rows: Row[]): string[] {
  const keys = new Set<string>()
  for (const r of rows) for (const k of Object.keys(r.props)) keys.add(k)
  return [...keys]
}

/**
 * Reads what the user typed into a cell as the column's type: `ja`/`nein` stay text in a text
 * column, numbers only become numbers in a number column, lists split at commas.
 */
export function parseInput(input: string, type: PropType): PropValue {
  const s = input.trim()
  if (!s) return null
  switch (type) {
    case 'number': {
      const n = Number(s.replace(',', '.'))
      return Number.isFinite(n) ? n : s
    }
    case 'checkbox':
      return /^(true|ja|yes|1|x)$/i.test(s)
    case 'list':
      return s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    case 'link':
      return LINK_RE.test(s) ? s : `[[${s.replace(/^\[\[|\]\]$/g, '')}]]`
    default:
      return s
  }
}

/** Parses the YAML-like config of a `write-table` block; unknown or broken parts are dropped. */
export function sanitizeConfig(raw: unknown): TableConfig & { from?: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const r = raw as Record<string, unknown>
  const out: TableConfig & { from?: string } = {}
  if (typeof r.from === 'string' && r.from.trim())
    out.from = r.from.trim().replace(/^\/+|\/+$/g, '')
  if (Array.isArray(r.columns)) out.columns = r.columns.filter((c) => typeof c === 'string')
  if (r.types && typeof r.types === 'object' && !Array.isArray(r.types)) {
    const types = Object.entries(r.types as Record<string, unknown>).filter(
      (e): e is [string, PropType] => PROP_TYPE_LIST.includes(e[1] as PropType)
    )
    if (types.length) out.types = Object.fromEntries(types)
  }
  if (Array.isArray(r.sort)) {
    out.sort = r.sort
      .map((s): TableSort | null => {
        if (typeof s === 'string') return { key: s, dir: 'asc' }
        if (s && typeof s === 'object' && typeof (s as TableSort).key === 'string')
          return {
            key: (s as TableSort).key,
            dir: (s as TableSort).dir === 'desc' ? 'desc' : 'asc'
          }
        return null
      })
      .filter((s): s is TableSort => s !== null)
  }
  if (Array.isArray(r.filter)) {
    out.filter = r.filter
      .map((f): TableFilter | null => {
        if (!f || typeof f !== 'object') return null
        const { key, op, value } = f as Record<string, unknown>
        if (typeof key !== 'string' || !FILTER_OPS.includes(op as FilterOp)) return null
        return value === undefined || value === null
          ? { key, op: op as FilterOp }
          : { key, op: op as FilterOp, value: String(value) }
      })
      .filter((f): f is TableFilter => f !== null)
  }
  return out
}
