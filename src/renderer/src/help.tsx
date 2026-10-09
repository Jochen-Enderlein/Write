import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@blocknote/mantine/style.css'
import './styles/tokens.css'
import './styles/app.css'
import './styles/editor.css'
import './styles/help.css'
import { blockSection, headingSection, stripBlockId } from '@shared/blockrefs'
import { normalizeTitle, parseLinkTarget } from '@shared/wikilinks'
import { invoke, on } from './api'
import { editorBridge } from './editor/bridge'
import i18next, { loadLanguage } from './i18n'
import { watchScrollbars } from './lib/scrollbars'
import { CONTENT } from './help/content'
import { HelpApp } from './help/HelpApp'

/** The examples' little world: links and embeds resolve to the help's own sample pages. */
function examplePage(title: string): [string, string] | undefined {
  const pages = CONTENT[i18next.language === 'en' ? 'en' : 'de'].examplePages
  return Object.entries(pages).find(([name]) => normalizeTitle(name) === normalizeTitle(title))
}

editorBridge.useTitleExists = (target) => {
  const { page } = parseLinkTarget(target)
  return !page || examplePage(page) !== undefined
}
editorBridge.loadPage = async (target) => {
  const { page, heading, block } = parseLinkTarget(target)
  const found = examplePage(page)
  if (!found) return null
  const [title, body] = found
  const text = block
    ? blockSection(body, block)
    : (heading ? headingSection(body, heading) : body)
        .split('\n')
        .map((l) => stripBlockId(l))
        .join('\n')
  return text === null ? null : { path: `${title}.md`, title, text: text.trim() }
}

function applyAccent(accent: string | null): void {
  if (accent) document.documentElement.style.setProperty('--accent', accent)
}
void invoke('app:accentColor').then(applyAccent)
on('app:accentColor', applyAccent)
on('settings:changed', () => void loadLanguage())
watchScrollbars()

void loadLanguage().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HelpApp />
    </StrictMode>
  )
)
