import { Component, type ReactNode } from 'react'
import { t } from '../i18n'

/** Keeps one broken page from blanking the whole window. */
export class ErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { error: Error | null; key: string }
> {
  override state = { error: null as Error | null, key: this.props.resetKey }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  static getDerivedStateFromProps(
    props: { resetKey: string },
    state: { key: string }
  ): { error: null; key: string } | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null
  }

  override componentDidCatch(error: Error): void {
    console.error('[ui]', error)
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="center-message">
        <div>
          <p style={{ fontWeight: 600, color: 'var(--label)' }}>{t('error.pageFailed')}</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{this.state.error.message}</p>
        </div>
      </div>
    )
  }
}
