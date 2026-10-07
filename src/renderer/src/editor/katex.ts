import { t } from '../i18n'

let loaded: Promise<typeof import('katex').default> | null = null

/** KaTeX and its stylesheet, loaded on first use. */
function katex(): Promise<typeof import('katex').default> {
  loaded ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
    ([m]) => m.default
  )
  return loaded
}

/** Renders LaTeX to HTML; a syntax error comes back as a readable message. */
export async function renderTex(
  latex: string,
  display: boolean
): Promise<{ html: string } | { error: string }> {
  try {
    const k = await katex()
    return {
      html: k.renderToString(latex, {
        displayMode: display,
        throwOnError: true,
        output: 'htmlAndMathml'
      })
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message.replace(/^KaTeX parse error: /, '') : String(err)
    return { error: `${t('editor.mathError')}: ${message}` }
  }
}
