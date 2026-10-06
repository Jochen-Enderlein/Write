import { diffLines } from 'diff'
import { useMemo } from 'react'

/** Line diff from `before` to `after`; long unchanged stretches are collapsed. */
export function DiffView({
  before,
  after,
  emptyText
}: {
  before: string
  after: string
  emptyText: string
}): React.JSX.Element {
  const parts = useMemo(() => diffLines(before, after), [before, after])
  if (parts.every((p) => !p.added && !p.removed))
    return (
      <div className="diff">
        <div className="line ctx">{emptyText}</div>
      </div>
    )
  return (
    <div className="diff">
      {parts.map((p, i) => {
        const lines = p.value.replace(/\n$/, '').split('\n')
        if (!p.added && !p.removed && lines.length > 6) {
          const first = i === 0
          const last = i === parts.length - 1
          return (
            <div key={i}>
              {!first &&
                lines.slice(0, 3).map((l, j) => (
                  <div key={'a' + j} className="line ctx">
                    {l || ' '}
                  </div>
                ))}
              <div className="gap">
                ⋯ {lines.length - (first || last ? 3 : 6)} unveränderte Zeilen
              </div>
              {!last &&
                lines.slice(-3).map((l, j) => (
                  <div key={'b' + j} className="line ctx">
                    {l || ' '}
                  </div>
                ))}
            </div>
          )
        }
        const cls = p.added ? 'add' : p.removed ? 'del' : 'ctx'
        return lines.map((l, j) => (
          <div key={`${i}-${j}`} className={`line ${cls}`}>
            {(p.added ? '+ ' : p.removed ? '− ' : '  ') + (l || ' ')}
          </div>
        ))
      })}
    </div>
  )
}
