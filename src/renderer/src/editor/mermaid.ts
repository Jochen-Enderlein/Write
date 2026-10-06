import { t } from '../i18n'

let counter = 0
let loaded: Promise<typeof import('mermaid').default> | null = null
let theme: string | null = null

/** Renders a Mermaid diagram into `el`; Mermaid itself is loaded on first use. */
export async function renderMermaid(source: string, el: HTMLElement): Promise<void> {
  if (!source.trim()) return
  try {
    loaded ??= import('mermaid').then((m) => m.default)
    const mermaid = await loaded
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const wanted = dark ? 'dark' : 'neutral'
    if (theme !== wanted) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: wanted,
        fontFamily: '-apple-system, system-ui, sans-serif'
      })
      theme = wanted
    }
    const { svg } = await mermaid.render(`mermaid-${++counter}`, source)
    el.innerHTML = svg
  } catch (err) {
    el.textContent = `${t('editor.mermaidError')}: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`
    el.classList.add('error')
  }
}
