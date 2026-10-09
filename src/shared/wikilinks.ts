/** `[[Titel]]` or `[[Titel|Anzeigetext]]` */
export const WIKILINK_RE = /\[\[([^[\]|\n]+?)(?:\|([^[\]\n]+?))?\]\]/g

export const TAG_RE = /(^|[\s(,;])#([\p{L}_][\p{L}\p{N}_\-/]*)/gu

export function normalizeTitle(t: string): string {
  return t.trim().toLowerCase()
}

export interface LinkTarget {
  /** Page part: a title, a file name or a vault path (`Ordner/Seite`), without `.md`. Empty for `[[#Abschnitt]]`. */
  page: string
  /** Heading after `#`, if any. */
  heading: string | null
  /** Block id after `#^` (`[[Seite#^abc123]]`), if any. */
  block: string | null
}

/** Splits `Seite#Abschnitt`, `Seite#^id`, `Ordner/Seite.md` or `#Abschnitt` into its parts. */
export function parseLinkTarget(target: string): LinkTarget {
  const i = target.indexOf('#')
  const page = (i === -1 ? target : target.slice(0, i)).trim().replace(/\.md$/i, '')
  const anchor = i === -1 ? '' : target.slice(i + 1).trim()
  if (anchor.startsWith('^')) return { page, heading: null, block: anchor.slice(1) || null }
  return { page, heading: anchor || null, block: null }
}

/** Where a link points inside its page, as editors take it: a heading text or `^id`. */
export function linkAnchor(target: LinkTarget): string | null {
  return target.block ? `^${target.block}` : target.heading
}

/** How a link is shown without alias: `Seite#Abschnitt` → `Seite › Abschnitt`. */
export function linkLabel(target: string): string {
  const { page, heading, block } = parseLinkTarget(target)
  const anchor = heading ?? (block ? `^${block}` : null)
  if (!anchor) return page || target
  return page ? `${page} › ${anchor}` : anchor
}

/** File extensions an embed `![[…]]` shows as an image. */
export const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif|heic|bmp)$/i

/**
 * Calls `fn` for every stretch of markdown that is not inside fenced code or inline code,
 * and stitches the results back together.
 */
export function mapOutsideCode(text: string, fn: (chunk: string) => string): string {
  const lines = text.split(/(?<=\n)/)
  let out = ''
  let fence: string | null = null
  let buf = ''
  const flush = (): void => {
    if (buf) out += mapOutsideInlineCode(buf, fn)
    buf = ''
  }
  for (const line of lines) {
    const m = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      out += line
      if (m && m[1]![0] === fence[0] && m[1]!.length >= fence.length && line.trim() === m[1])
        fence = null
    } else if (m) {
      flush()
      fence = m[1]!
      out += line
    } else buf += line
  }
  flush()
  return out
}

function mapOutsideInlineCode(text: string, fn: (chunk: string) => string): string {
  let out = ''
  let i = 0
  const re = /(`+)[\s\S]*?\1/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    out += fn(text.slice(i, m.index)) + m[0]
    i = m.index + m[0].length
  }
  return out + fn(text.slice(i))
}

export function extractWikilinks(text: string): string[] {
  const found: string[] = []
  mapOutsideCode(text, (chunk) => {
    for (const m of chunk.matchAll(WIKILINK_RE)) {
      const page = parseLinkTarget(m[1]!).page
      if (page && !IMAGE_EXT_RE.test(page)) found.push(page)
    }
    return chunk
  })
  return found
}

export function extractTags(text: string): string[] {
  const found = new Set<string>()
  mapOutsideCode(text, (chunk) => {
    for (const m of chunk.matchAll(TAG_RE)) found.add(m[2]!.toLowerCase())
    return chunk
  })
  return [...found]
}

/**
 * Rewrites every link to `oldTitle` so it points to `newTitle`. Aliases, `#Abschnitt` and a folder
 * prefix (`[[Ordner/Alt]]`) are kept.
 */
export function rewriteWikilinks(text: string, oldTitle: string, newTitle: string): string {
  const old = normalizeTitle(oldTitle)
  return mapOutsideCode(text, (chunk) =>
    chunk.replace(WIKILINK_RE, (all, target: string, alias?: string) => {
      const hash = target.indexOf('#')
      const pagePart = (hash === -1 ? target : target.slice(0, hash)).trim().replace(/\.md$/i, '')
      const rest = hash === -1 ? '' : target.slice(hash)
      const slash = pagePart.lastIndexOf('/')
      if (!pagePart || normalizeTitle(pagePart.slice(slash + 1)) !== old) return all
      const next = pagePart.slice(0, slash + 1) + newTitle + rest
      return alias ? `[[${next}|${alias}]]` : `[[${next}]]`
    })
  )
}

/** Rewrites relative asset URLs after the page's own folder was renamed. */
export function rewriteAssetPrefix(text: string, oldStem: string, newStem: string): string {
  if (oldStem === newStem) return text
  const enc = (s: string): string => encodeURI(s)
  const pairs: [string, string][] = [
    [`](${oldStem}/`, `](${newStem}/`],
    [`](<${oldStem}/`, `](<${newStem}/`],
    [`](${enc(oldStem)}/`, `](${enc(newStem)}/`]
  ]
  return mapOutsideCode(text, (chunk) => {
    let c = chunk
    for (const [a, b] of pairs) c = c.split(a).join(b)
    return c
  })
}
