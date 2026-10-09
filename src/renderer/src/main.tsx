import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@blocknote/mantine/style.css'
import './styles/tokens.css'
import './styles/app.css'
import './styles/editor.css'
import { loadLanguage } from './i18n'
import { watchScrollbars } from './lib/scrollbars'
import { App } from './App'

watchScrollbars()

void loadLanguage().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
)
