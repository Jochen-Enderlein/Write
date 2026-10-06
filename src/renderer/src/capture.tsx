import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'
import './styles/tokens.css'
import './styles/capture.css'
import { loadLanguage } from './i18n'
import { errorMessage, invoke, on } from './api'
import { CalendarIcon, CheckIcon } from './components/Icons'

function Capture(): React.JSX.Element {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(
    () =>
      on('capture:shown', () => {
        setState('idle')
        requestAnimationFrame(() => ref.current?.focus())
      }),
    []
  )
  useEffect(() => ref.current?.focus(), [])

  const hide = (): void => void invoke('capture:hide')

  const submit = async (): Promise<void> => {
    if (!text.trim() || state === 'saving') return
    setState('saving')
    try {
      await invoke('capture:append', text)
      setState('saved')
      setText('')
      setTimeout(hide, 650)
    } catch (err) {
      setError(errorMessage(err))
      setState('error')
    }
  }

  return (
    <div className={`capture ${state === 'saved' ? 'saved' : ''}`}>
      <div className="capture-head">
        <CalendarIcon size={14} />
        <span>{t('capture.target')}</span>
      </div>
      <textarea
        ref={ref}
        value={text}
        placeholder={t('capture.placeholder')}
        aria-label={t('capture.placeholder')}
        onChange={(e) => {
          setText(e.target.value)
          if (state !== 'idle' && state !== 'saving') setState('idle')
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') hide()
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            void submit()
          }
        }}
      />
      <div className="capture-foot">
        {state === 'saved' ? (
          <span className="ok">
            <CheckIcon size={14} /> {t('capture.saved')}
          </span>
        ) : state === 'error' ? (
          <span className="err">{error}</span>
        ) : (
          <span>{t('capture.hint')}</span>
        )}
      </div>
    </div>
  )
}

// The capture window lives for the whole session, so it follows language changes live
on('settings:changed', () => void loadLanguage())

void loadLanguage().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Capture />
    </StrictMode>
  )
)
