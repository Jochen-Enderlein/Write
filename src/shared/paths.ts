/** Helpers for vault-relative POSIX paths. */

export const ASSETS_DIR = '_assets'
export const TRASH_DIR = '.trash'
export const CONFIG_DIR = '.docuapp'
export const JOURNAL_DIR = 'Journal'

export function basename(p: string): string {
  const i = p.lastIndexOf('/')
  return i === -1 ? p : p.slice(i + 1)
}

export function dirname(p: string): string {
  const i = p.lastIndexOf('/')
  return i === -1 ? '' : p.slice(0, i)
}

export function join(...parts: string[]): string {
  return parts.filter((p) => p !== '').join('/')
}

/** `Projekte/Write-App.md` → `Write-App` */
export function stemOf(p: string): string {
  return basename(p).replace(/\.md$/i, '')
}

/** Folder that holds a page's children and assets: `Projekte/Write-App.md` → `Projekte/Write-App` */
export function childFolderOf(pagePath: string): string {
  return pagePath.replace(/\.md$/i, '')
}

export function isMarkdown(p: string): boolean {
  return /\.md$/i.test(p)
}

/** Hidden or internal entries that never show up in the page tree. */
export function isHiddenName(name: string): boolean {
  return name.startsWith('.') || name === ASSETS_DIR
}

/** Turns a page title into a safe file name stem. */
export function sanitizeTitle(title: string): string {
  const cleaned = title
    // eslint-disable-next-line no-control-regex
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.slice(0, 180) || 'Unbenannt'
}

/** Relative URL from a page's directory to an asset in its own `_assets/` folder. */
export function assetUrlFor(pagePath: string, fileName: string): string {
  return join(stemOf(pagePath), ASSETS_DIR, fileName)
}

/** Resolves a relative URL found in a page against the page's directory. */
export function resolveRelative(pagePath: string, url: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('/') || url.startsWith('#')) return null
  const stack = dirname(pagePath).split('/').filter(Boolean)
  for (const seg of url.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (stack.length === 0) return null
      stack.pop()
    } else stack.push(seg)
  }
  return stack.join('/')
}

/** True if `child` equals `parent` or lies inside it. */
export function isWithin(parent: string, child: string): boolean {
  return parent === '' || child === parent || child.startsWith(parent + '/')
}
