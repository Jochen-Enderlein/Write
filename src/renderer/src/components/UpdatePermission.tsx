import { useTranslation } from 'react-i18next'
import { useStore } from '../store'

/**
 * Asked once, on the second launch (like Sparkle): each automatic check contacts GitHub, so it
 * only happens with consent. Closing without an answer asks again next time.
 */
export function UpdatePermissionSheet({ onClose }: { onClose(): void }): React.JSX.Element {
  const { t } = useTranslation()
  const choose = (autoUpdates: 'on' | 'off'): void => {
    void useStore.getState().updateSettings({ autoUpdates })
    onClose()
  }
  return (
    <div className="permission">
      <h2>{t('updatePermission.title')}</h2>
      <p>{t('updatePermission.body')}</p>
      <p className="permission-note">{t('updatePermission.note')}</p>
      <div className="permission-actions">
        <button className="button" onClick={() => choose('off')}>
          {t('updatePermission.no')}
        </button>
        <button className="button primary" autoFocus onClick={() => choose('on')}>
          {t('updatePermission.yes')}
        </button>
      </div>
    </div>
  )
}
