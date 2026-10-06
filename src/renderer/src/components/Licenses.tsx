import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '../api'

/** The license texts of every open-source library bundled into Write (written at build time). */
export function LicensesSheet({ onClose }: { onClose(): void }): React.JSX.Element {
  const { t } = useTranslation()
  const [text, setText] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    void invoke('app:licenses').then(setText, () => setText(null))
  }, [])
  return (
    <>
      <div className="sheet-header">
        <h2>{t('about.thirdParty')}</h2>
        <button className="button" onClick={onClose}>
          {t('common.done')}
        </button>
      </div>
      <div className="licenses">
        {text === null && <p className="licenses-missing">{t('about.thirdPartyMissing')}</p>}
        {text && <pre>{text}</pre>}
      </div>
    </>
  )
}
