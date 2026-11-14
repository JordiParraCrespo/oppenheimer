import 'intl-pluralrules';
import en from '@oppenheimer/translations/en/index.json';
import es from '@oppenheimer/translations/es/index.json';
import { defaultLocale, defaultNS, type Locale, locales } from '@oppenheimer/translations/locales';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { storage } from '../../platform';

/** Preference key — MMKV, not the keychain. */
export const LOCALE_STORAGE_KEY = 'oppenheimer.locale';

function isSupported(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** Best-effort device language, falling back to the default locale. */
function getDeviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode;
  return isSupported(code) ? code : defaultLocale;
}

const storedLocale = storage.getItem(LOCALE_STORAGE_KEY);

// A native app ships every catalog in its bundle: there is no first visit to
// keep light, and no network to wait on before the first frame.
const resources = {
  en: { [defaultNS]: en },
  es: { [defaultNS]: es },
} satisfies Record<Locale, unknown>;

i18n.use(initReactI18next).init({
  resources,
  defaultNS,
  lng: isSupported(storedLocale) ? storedLocale : getDeviceLocale(),
  fallbackLng: defaultLocale,
  supportedLngs: [...locales],
  react: { useSuspense: false },
  returnNull: false,
  interpolation: {
    // React already escapes values, so i18next must not double-escape.
    // Number/date formatting uses `{{val, number}}` / `{{val, datetime}}` via
    // i18next's built-in Intl formatter (enabled by intl-pluralrules above).
    escapeValue: false,
  },
});

/** Change the active language and persist it for future launches. */
export async function setLocale(locale: Locale): Promise<void> {
  await i18n.changeLanguage(locale);
  storage.setItem(LOCALE_STORAGE_KEY, locale);
}

export default i18n;
