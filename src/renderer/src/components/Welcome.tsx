import { useTranslation } from 'react-i18next'
import { invoke } from '../api'
import { useStore } from '../store'
import { VaultIcon } from './Icons'
import appIcon from '../assets/icon.png'

export function Welcome(): React.JSX.Element {
  const { t } = useTranslation()
  const vault = useStore((s) => s.vault)
  const s = useStore.getState
  return (
    <div className="welcome">
      <div className="welcome-card glass">
        <img className="logo" src={appIcon} alt="" width={96} height={96} />
        <h1>{t('welcome.title')}</h1>
        <p>{t('welcome.subtitle')}</p>
        <div className="actions">
          <button
            className="button primary large"
            onClick={() => void invoke('vault:create').then((st) => s().setVault(st), s().fail)}
          >
            {t('welcome.create')}
          </button>
          <button
            className="button large"
            onClick={() => void invoke('vault:openDialog').then((st) => s().setVault(st), s().fail)}
          >
            {t('welcome.open')}
          </button>
        </div>
        {vault && vault.vaults.length > 0 && (
          <div className="recent">
            <h2>{t('welcome.recent')}</h2>
            {vault.vaults.map((v) => (
              <button
                key={v.id}
                className="sidebar-item"
                onClick={() =>
                  void invoke('vault:switch', v.id).then((st) => s().setVault(st), s().fail)
                }
              >
                <VaultIcon />
                <span className="label">{v.name}</span>
                <span className="badge">{v.path.replace(/^\/Users\/[^/]+/, '~')}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
