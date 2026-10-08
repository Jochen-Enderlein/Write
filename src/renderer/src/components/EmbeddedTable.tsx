import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import YAML from 'yaml'
import { sanitizeConfig, type BlockConfig } from '@shared/properties'
import { childFolderOf } from '@shared/paths'
import type { TableBlockProps } from '../editor/bridge'
import { useStore } from '../store'
import { TableView } from './TableView'

/** Writes a table config back as the block's YAML, leaving out what is unset. */
export function configToYaml(cfg: BlockConfig): string {
  const clean = Object.fromEntries(
    Object.entries(cfg).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length))
  )
  if (!Object.keys(clean).length) return ''
  return YAML.stringify(clean, { lineWidth: 0, flowCollectionPadding: false }).replace(/\n$/, '')
}

/**
 * A `write-table` block: the table of the folder named in `from`, or of the page's own
 * subpages when `from` is missing. Changes to sorting and filters go back into the block.
 */
export function EmbeddedTable({ source, editable, onSource }: TableBlockProps): React.JSX.Element {
  const { t } = useTranslation()
  const view = useStore((s) => s.view)
  const tree = useStore((s) => s.tree)
  const { cfg, broken } = useMemo(() => {
    try {
      return { cfg: sanitizeConfig(YAML.parse(source) ?? {}), broken: false }
    } catch {
      return { cfg: {}, broken: true }
    }
  }, [source])
  const page = view.kind === 'page' ? view.path : null
  const folder = cfg.from ?? (page ? childFolderOf(page) : '')

  // Only plain folders and pages' child folders hold rows; anything else is a typo
  const exists = useMemo(() => {
    if (folder === '') return true
    const walk = (nodes: typeof tree): boolean =>
      nodes.some(
        (n) =>
          n.folder === folder ||
          (n.path && childFolderOf(n.path) === folder) ||
          (n.children ? walk(n.children) : false)
      )
    return walk(tree)
  }, [tree, folder])

  if (broken) return <div className="db-missing">{t('table.brokenConfig')}</div>
  if (!exists && cfg.from && !cfg.source)
    return <div className="db-missing">{t('table.folderMissing', { folder: cfg.from })}</div>

  const { from, source: kind, ...table } = cfg
  return (
    <div className="db-embed">
      <div className="db-embed-head">
        <span className="db-embed-source">
          {kind === 'tasks' ? t('tasks.all') : (from ?? t('table.subpages'))}
        </span>
      </div>
      <TableView
        source={kind === 'tasks' ? { kind: 'tasks' } : { kind: 'folder', folder }}
        config={table}
        compact
        onConfig={(next) => editable && onSource(configToYaml({ source: kind, from, ...next }))}
      />
    </div>
  )
}
