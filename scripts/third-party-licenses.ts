import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

/**
 * MIT, BSD, Apache and friends allow bundling only if their notices travel with every copy.
 * Vite strips those comments, so this plugin collects the packages that actually ended up in
 * the bundle and writes their license texts to `third-party-licenses.txt` next to it. The app
 * shows the file under Settings → About Write.
 */
export function thirdPartyLicenses(): Plugin {
  return {
    name: 'write:third-party-licenses',
    apply: 'build',
    generateBundle() {
      const roots = new Set<string>()
      for (const id of this.getModuleIds()) {
        const m = /^(.*[\\/]node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+)/.exec(id.replace(/\0/g, ''))
        if (m) roots.add(m[1]!)
      }
      const entries = [...roots]
        .map((dir) => {
          const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
            name: string
            version: string
            license?: string
            author?: string | { name?: string }
            repository?: string | { url?: string }
          }
          const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying|notice)/i.test(f))
          const text = file ? readFileSync(path.join(dir, file), 'utf8').trim() : null
          const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name
          return { ...pkg, author, text }
        })
        .sort((a, b) => a.name.localeCompare(b.name))

      const missing = entries.filter((e) => !e.text && !e.license)
      if (missing.length)
        this.warn(`Keine Lizenz gefunden: ${missing.map((e) => e.name).join(', ')}`)

      const body = entries
        .map((e) =>
          [
            `${e.name} ${e.version}`,
            `Lizenz: ${e.license ?? 'siehe Text'}${e.author ? ` · ${e.author}` : ''}`,
            '',
            e.text ?? `(Kein Lizenztext im Paket; Lizenz laut package.json: ${e.license})`
          ].join('\n')
        )
        .join('\n\n' + '─'.repeat(72) + '\n\n')
      this.emitFile({
        type: 'asset',
        fileName: 'third-party-licenses.txt',
        source:
          `Write enthält die folgenden Open-Source-Bibliotheken (${entries.length}).\n` +
          `Ihre Lizenzen und Urheberrechtshinweise:\n\n${body}\n`
      })
    }
  }
}
