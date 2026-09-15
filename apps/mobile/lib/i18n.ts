import 'intl-pluralrules';
import {
  defaultLocale,
  defaultNS,
  type Locale,
  locales,
  resources,
} from '@oppenheimer/translations';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { storage } from './storage/mmkv';

/** Preference key — MMKV, not the keychain. */
export const LOCALE_STORAGE_KEY = 'oppenheimer.locale';

function isSupported(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Best-effort device language, falling back to the default locale. */
function getDeviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode;
  return isSupported(code) ? code : defaultLocale;
}

const storedLocale = storage.getItem<string>(LOCALE_STORAGE_KEY);

i18n.use(initReactI18next).init({
  resources: resources as typeof i18n.options.resources,
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
