import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GraphData } from '@shared/types'
import { invoke } from '../api'
import { useIpcEvent } from '../lib/hooks'
import { useStore } from '../store'
import { buildGraph, globalLayout, localLayout, type Graph } from '../graph/layout'
import type { GraphScene } from '../graph/scene'

/** Options survive switching views within a session. */
const prefs = { tags: true, ghosts: false, depth: 2 }

/**
 * The vault as a solar system. Without `center` every group of connected pages is a system of
 * its own (global); with a center that page (or `#tag`) is the sun and its links the planets.
 */
export function GraphView({ center }: { center: string | null }): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useStore((s) => s.navigate)
  const openPage = useStore((s) => s.openPage)
  const [data, setData] = useState<GraphData | null>(null)
  const [tags, setTags] = useState(prefs.tags)
  const [ghosts, setGhosts] = useState(prefs.ghosts)
  const [depth, setDepth] = useState(prefs.depth)
  const [hovered, setHovered] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [failed, setFailed] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  const labels = useRef<HTMLDivElement>(null)
  const scene = useRef<GraphScene | null>(null)
  const [sceneReady, setSceneReady] = useState(false)

  useEffect(() => {
    prefs.tags = tags
    prefs.ghosts = ghosts
    prefs.depth = depth
  }, [tags, ghosts, depth])

  const load = useCallback(() => {
    void invoke('index:graph').then(setData, () => setData({ pages: [], links: [], ghosts: [] }))
  }, [])
  useEffect(load, [load])
  // Keep up with edits, but don't rebuild the scene on every keystroke elsewhere
  const reload = useRef<ReturnType<typeof setTimeout>>(undefined)
  useIpcEvent('index:updated', () => {
    clearTimeout(reload.current)
    reload.current = setTimeout(load, 1500)
  })
  useEffect(() => () => clearTimeout(reload.current), [])

  const graph: Graph | null = useMemo(
    () => (data ? buildGraph(data, { tags, ghosts }) : null),
    [data, tags, ghosts]
  )
  const centerIndex = center !== null && graph ? (graph.byId.get(center) ?? -1) : -1
  const layout = useMemo(() => {
    if (!graph) return null
    if (center === null) return globalLayout(graph)
    return centerIndex >= 0 ? localLayout(graph, centerIndex, depth) : null
  }, [graph, center, centerIndex, depth])

  // Latest handlers for the scene, which is created once
  const actions = useRef({
    select: (_n: number | null) => {},
    open: (_n: number) => {}
  })
  const openNode = useCallback(
    (n: number) => {
      const node = graph?.nodes[n]
      if (!node) return
      if (node.kind === 'page') openPage(node.id)
      else if (node.kind === 'tag') navigate({ kind: 'search', query: '', tag: node.id.slice(1) })
    },
    [graph, openPage, navigate]
  )
  actions.current.open = openNode
  actions.current.select = (n) => {
    setSelected(n)
    if (n === null) scene.current?.setSelected(null)
    else if (center !== null && graph && graph.nodes[n]!.kind !== 'ghost' && n !== centerIndex)
      navigate({ kind: 'graph', center: graph.nodes[n]!.id })
    else scene.current?.focus(n)
  }

  useEffect(() => {
    let disposed = false
    let created: GraphScene | null = null
    void import('../graph/scene')
      .then(({ GraphScene }) => {
        if (disposed || !host.current || !labels.current) return
        created = new GraphScene(host.current, labels.current, {
          hover: setHovered,
          select: (n) => actions.current.select(n),
          open: (n) => actions.current.open(n)
        })
        scene.current = created
        setSceneReady(true)
      })
      .catch((err) => {
        console.error('[graph]', err)
        setFailed(true)
      })
    return () => {
      disposed = true
      created?.dispose()
      scene.current = null
    }
  }, [])

  useEffect(() => {
    if (!sceneReady || !graph || !layout) return
    scene.current!.setData(graph, layout)
    setSelected(null)
  }, [sceneReady, graph, layout, center])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !graph) return []
    return graph.nodes
      .map((n, i) => ({ n, i }))
      .filter(({ n }) => n.kind !== 'ghost' && n.label.toLowerCase().includes(q))
      .sort((a, b) => b.n.degree - a.n.degree)
      .slice(0, 8)
  }, [query, graph])

  const jump = (i: number): void => {
    setQuery('')
    if (center !== null && i !== centerIndex)
      navigate({ kind: 'graph', center: graph!.nodes[i]!.id })
    else {
      scene.current?.focus(i)
      setSelected(i)
    }
  }

  const info = selected ?? hovered
  const infoNode = info !== null ? graph?.nodes[info] : undefined
  const empty = graph !== null && graph.nodes.length === 0

  return (
    <div className="graph-view">
      <div className="graph-canvas" ref={host} />
      <div className="graph-labels" ref={labels} />

      <div className="graph-panel">
        <div className="graph-mode" role="tablist">
          <button
            role="tab"
            aria-selected={center === null}
            onClick={() => navigate({ kind: 'graph', center: null })}
          >
            {t('graph.global')}
          </button>
          <button
            role="tab"
            aria-selected={center !== null}
            disabled={center === null && selected === null}
            title={center === null && selected === null ? t('graph.localHint') : undefined}
            onClick={() =>
              center === null &&
              selected !== null &&
              navigate({ kind: 'graph', center: graph!.nodes[selected]!.id })
            }
          >
            {t('graph.local')}
          </button>
        </div>
        <label className="graph-search">
          <input
            value={query}
            placeholder={t('graph.find')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) jump(matches[0].i)
              if (e.key === 'Escape') setQuery('')
            }}
          />
          {matches.length > 0 && (
            <ul className="graph-matches">
              {matches.map(({ n, i }) => (
                <li key={n.id}>
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => jump(i)}>
                    {n.icon && <span>{n.icon}</span>}
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
        {center !== null && (
          <label className="graph-option">
            <span>{t('graph.depth')}</span>
            <input
              type="range"
              min={1}
              max={3}
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
            />
            <span className="graph-depth">{depth}</span>
          </label>
        )}
        <label className="graph-option">
          <input type="checkbox" checked={tags} onChange={(e) => setTags(e.target.checked)} />
          <span>{t('graph.tags')}</span>
        </label>
        <label className="graph-option">
          <input type="checkbox" checked={ghosts} onChange={(e) => setGhosts(e.target.checked)} />
          <span>{t('graph.ghosts')}</span>
        </label>
        {layout?.truncated && <p className="graph-note">{t('graph.truncated')}</p>}
      </div>

      {infoNode && (
        <div className="graph-info" aria-live="polite">
          <div className="graph-info-title">
            {infoNode.icon && <span>{infoNode.icon}</span>}
            {infoNode.label}
          </div>
          <div className="graph-info-meta">
            {infoNode.kind === 'tag'
              ? t('graph.tagPages', { count: infoNode.degree })
              : infoNode.kind === 'ghost'
                ? t('graph.ghost')
                : t('graph.links', { count: infoNode.degree })}
          </div>
          {selected !== null && infoNode.kind !== 'ghost' && (
            <div className="graph-info-actions">
              <button onClick={() => openNode(selected)}>
                {infoNode.kind === 'tag' ? t('graph.showPages') : t('graph.open')}
              </button>
              {center === null && (
                <button onClick={() => navigate({ kind: 'graph', center: infoNode.id })}>
                  {t('graph.centre')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {(empty || failed || (center !== null && graph && centerIndex < 0)) && (
        <div className="graph-message">
          {failed ? t('graph.failed') : empty ? t('graph.empty') : t('graph.notIndexed')}
        </div>
      )}
      <div className="graph-hint">{t('graph.hint')}</div>
    </div>
  )
}
