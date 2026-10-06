import i18next, { type i18n } from 'i18next'
import de from './locales/de.json'
import en from './locales/en.json'

export const resources = { de: { translation: de }, en: { translation: en } } as const

export type Language = keyof typeof resources

/** Picks the UI language from the setting, or from the system locale (German or English). */
export function resolveLanguage(setting: string | undefined, systemLocale: string): Language {
  if (setting === 'de' || setting === 'en') return setting
  return systemLocale.toLowerCase().startsWith('de') ? 'de' : 'en'
}

/** BCP 47 locale for dates and numbers. */
export function localeOf(lng: string): string {
  return lng === 'en' ? 'en-US' : 'de-DE'
}

export function createI18n(lng: Language = 'de'): i18n {
  const inst = i18next.createInstance()
  void inst.init({
    lng,
    fallbackLng: 'de',
    resources,
    interpolation: { escapeValue: false },
    initAsync: false
  })
  return inst
}
