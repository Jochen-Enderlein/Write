/** Exports are always light: dark-mode rules are switched off. */
const lightOnly = (css: string): string =>
  css.replace(/prefers-color-scheme:\s*dark/g, 'prefers-color-scheme: no-dark-in-export')

const EXPORT_CSS = `
:root { color-scheme: light; }
html, body { background: #fff; margin: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
/* The app's page fade-in starts at opacity 0; a PDF is rendered before it would run */
*, *::before, *::after { animation: none !important; transition: none !important; }
.page { max-width: 720px; margin: 0 auto; padding: 48px 40px 64px; cursor: auto; }
.page .bn-editor { padding-inline: 0; }
.page-title { font: 700 34px/1.2 var(--font-display); color: var(--label); margin: 0 0 22px; padding: 0; }
.page-icon { font-size: 46px; line-height: 1; margin: 0 0 10px; padding: 0; }
.bn-side-menu, .mermaid-code, .mermaid-toggle, .math-code, .math-toggle, .raw-md-label, .bn-trailing-block { display: none !important; }
.callout-kind select { display: none; }
.wikilink { text-decoration: none; }
/* Block ids (^abc123) are link targets, not text */
.block-id { display: none !important; }
@media print {
  .page { padding: 0; max-width: none; }
  .bn-block-outer { break-inside: avoid-page; }
}
`

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!
  )
}

/**
 * All CSS the app has loaded right now (BlockNote, Mantine, app styles), so the export looks like
 * the editor. Sheets the page may not read are skipped.
 */
function loadedCss(): string {
  let css = ''
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) css += rule.cssText + '\n'
    } catch {
      // not readable
    }
  }
  return css
}

/**
 * Builds a standalone HTML document from the editor as it is rendered right now (highlighted
 * code, Mermaid SVGs, callouts). Images keep their `vault-asset://` URLs; main inlines them.
 */
export function buildExportHtml(
  editorEl: HTMLElement | undefined,
  title: string,
  icon: string | null,
  lang: string
): string {
  const clone =
    (editorEl?.cloneNode(true) as HTMLElement | undefined) ?? document.createElement('div')
  for (const el of [clone, ...clone.querySelectorAll('[contenteditable]')])
    el.removeAttribute('contenteditable')
  clone.querySelectorAll('input.callout-title').forEach((el) => {
    const input = el as HTMLInputElement
    const span = document.createElement('span')
    span.className = 'callout-title'
    span.textContent = input.value || input.placeholder
    input.replaceWith(span)
  })
  clone.querySelectorAll('.bn-side-menu, .bn-formatting-toolbar').forEach((el) => el.remove())
  // A page that starts with its own title as heading doesn't need the title twice
  const firstHeading = clone.querySelector('[data-content-type]')
  const repeatsTitle =
    firstHeading?.getAttribute('data-content-type') === 'heading' &&
    firstHeading.textContent?.trim() === title.trim()
  const css = lightOnly(loadedCss()) + EXPORT_CSS
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Write">
<title>${escapeHtml(title)}</title>
<style>${css}</style>
</head>
<body>
<div class="page">
${icon ? `<div class="page-icon">${escapeHtml(icon)}</div>` : ''}
${repeatsTitle ? '' : `<h1 class="page-title">${escapeHtml(title)}</h1>`}
<div class="bn-container write-editor" data-color-scheme="light" data-mantine-color-scheme="light">
${clone.outerHTML}
</div>
</div>
</body>
</html>`
}
