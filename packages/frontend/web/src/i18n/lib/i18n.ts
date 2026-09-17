import en from '@oppenheimer/translations/en/index.json';
import { loadLocaleMessages } from '@oppenheimer/translations/lazy';
import { defaultLocale, defaultNS, locales } from '@oppenheimer/translations/locales';
import i18n, { type BackendModule } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

/** localStorage key used to persist the user's language choice. */
export const LOCALE_STORAGE_KEY = 'oppenheimer-locale';

/**
 * Serves a catalog per locale, on demand, from its own chunk.
 *
 * Only the default locale is bundled (below): it is the fallback every other
 * locale resolves missing keys against, and it is what most readers get, so
 * making it a request would cost every first visit. Every other catalog is
 * fetched when it is actually the reader's — which is also what keeps the entry
 * chunk flat as locales are added, instead of ~14KB gzipped heavier each time.
 */
const lazyCatalogs: BackendModule = {
  type: 'backend',
  init: () => {},
  read: (language, _namespace, callback) => {
    loadLocaleMessages(language)
      .then((messages) => callback(null, messages))
      // `false` is i18next's "do not retry": an unknown or unsupported tag is
      // not a transient failure, and `fallbackLng` already covers the reader.
      .catch((error: Error) => callback(error, false));
  },
};

/**
 * Resolves once the reader's own catalog is in memory.
 *
 * `main.tsx` renders behind it. For the default locale it settles without a
 * request; for any other it is one small fetch, and awaiting it is what stops
 * a Spanish reader seeing a frame of English before the catalog lands.
 */
export const i18nReady = i18n
  .use(LanguageDetector)
  .use(lazyCatalogs)
  .use(initReactI18next)
  .init({
    // The fallback locale, bundled. `partialBundledLanguages` tells i18next
    // that what it has here is not the whole set, so it still asks the backend
    // for anything else.
    resources: { [defaultLocale]: { [defaultNS]: en } },
    partialBundledLanguages: true,
    defaultNS,
    fallbackLng: defaultLocale,
    supportedLngs: [...locales],
    interpolation: {
      // React already escapes values, so i18next must not double-escape.
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
    },
  });

export default i18n;
