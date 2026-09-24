import { type Locale, locales } from './locales';

/**
 * A catalog as a bundler hands it over: i18next wants a plain nested object of
 * message strings, and this is the widest type that satisfies its
 * `ResourceLanguage`. The precise key set is `Messages`, checked where the apps
 * type `t()` — not here, where the point is to stay loadable.
 */
export type Catalog = Record<string, unknown>;

/**
 * One dynamic import per locale, so a bundler emits one chunk per catalog and
 * the app fetches only the one its reader is using.
 *
 * Written out rather than built from a template string: the bundler needs a
 * statically analysable specifier to know which files to split out, and a
 * computed `import(\`./${locale}/index.json\`)` would either bundle every
 * match or resolve nothing at all.
 *
 * The default locale is listed too, even though the web app bundles it eagerly
 * as its i18next fallback — the map stays correct if the default changes, and
 * the chunk it produces is simply never requested.
 */
const LOADERS: Record<Locale, () => Promise<{ default: Catalog }>> = {
  en: () => import('./en'),
  es: () => import('./es'),
};

/** Whether a string is a locale this package ships a catalog for. */
export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * Loads one locale's catalog.
 *
 * Rejects on an unknown locale rather than falling back silently: i18next asks
 * for whatever the browser reports, and a typo'd or unsupported tag should
 * surface as a failed read so its own `fallbackLng` handles it.
 */
export async function loadLocaleMessages(locale: string): Promise<Catalog> {
  if (!isLocale(locale)) throw new Error(`Unknown locale: ${locale}`);
  const module = await LOADERS[locale]();
  return module.default;
}
