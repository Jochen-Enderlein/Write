import { createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { MarkdownPreview, type MarkdownPreviewHandle } from './MarkdownPreview'

/**
 * Renders a piece of Markdown the way the editor shows it, off screen, and returns it as a
 * standalone HTML document (like the page export). Waits for diagrams to finish drawing.
 */
export async function renderMarkdownHtml(
  path: string,
  markdown: string,
  title: string,
  icon: string | null
): Promise<string> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:820px;pointer-events:none'
  document.body.appendChild(host)
  const root = createRoot(host)
  const ref = createRef<MarkdownPreviewHandle>()
  try {
    root.render(<MarkdownPreview ref={ref} path={path} body={markdown} />)
    const settled = (): boolean =>
      !!ref.current &&
      [...host.querySelectorAll('.mermaid-preview')].every(
        (el) => el.querySelector('svg') || el.classList.contains('error') || el.textContent
      )
    const start = performance.now()
    while (!settled() && performance.now() - start < 5000)
      await new Promise((r) => setTimeout(r, 50))
    // One more frame for code highlighting and images
    await new Promise((r) => setTimeout(r, 150))
    return ref.current?.exportHtml(title, icon) ?? ''
  } finally {
    root.unmount()
    host.remove()
  }
}
