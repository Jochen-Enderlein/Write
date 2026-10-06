import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { localeOf, resources } from '@shared/i18n'

void i18next.use(initReactI18next).init({
  lng: 'de',
  fallbackLng: 'de',
  resources,
  interpolation: { escapeValue: false },
  initAsync: false
})

export default i18next
export const t = i18next.t.bind(i18next)

/** BCP 47 locale of the current UI language, for dates and numbers. */
export function locale(): string {
  return localeOf(i18next.language)
}

/** Switches to the language main resolved from the setting and the system. */
export async function loadLanguage(): Promise<void> {
  try {
    const lng = await window.write.invoke('app:language')
    if (lng !== i18next.language) await i18next.changeLanguage(lng)
    document.documentElement.lang = lng
  } catch {
    // stay with German
  }
}
