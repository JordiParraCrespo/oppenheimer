import type en from './en';

/**
 * Locale metadata, deliberately free of catalog imports.
 *
 * `index.ts` imports every locale's JSON eagerly, which is what the API wants.
 * A browser needs one catalog, and importing `locales` or `Messages` from the
 * root barrel drags every catalog into the web app's entry chunk.
 *
 * Anything that only needs the list, the default, the namespace or the *shape*
 * of a catalog imports it from here; the catalogs themselves come from
 * `@oppenheimer/translations/lazy` (one request per locale, on demand) or from the
 * root barrel (all of them, eagerly).
 */
export const locales = ['en', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const defaultNS = 'translation' as const;

/**
 * Shape of a single locale's message catalog (English is the source of truth).
 *
 * The import is `import type`: the JSON is read for its inferred type only and
 * erased at build time, so nothing that imports `Messages` ships a catalog.
 */
export type Messages = typeof en;
