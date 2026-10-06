/** Renders an FTS snippet whose matches are wrapped in \u0001…\u0002 – safely, without HTML. */
export function Snippet({ text }: { text: string }): React.JSX.Element {
  // eslint-disable-next-line no-control-regex
  const parts = text.split(/(\u0001[^\u0002]*\u0002)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('\u0001') ? (
          <mark key={i}>{p.slice(1, -1)}</mark>
        ) : (
          <span key={i}>{p.replace(/\s+/g, ' ')}</span>
        )
      )}
    </>
  )
}
