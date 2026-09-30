import en from './en';
import es from './es';
import { defaultNS } from './locales';
import { namespaces } from './namespaces';

/**
 * The eager barrel: importing anything from here pulls in *every* catalog.
 * The API imports the merged `{locale}/index.json` files directly, and the web
 * app imports metadata from `@oppenheimer/translations/locales` and catalogs
 * from `@oppenheimer/translations/lazy` — see the note in `locales.ts`.
 */
export { defaultLocale, defaultNS, type Locale, locales, type Messages } from './locales';
export { type Namespace, namespaces } from './namespaces';

export const messages = { en, es } as const;

/**
 * Resources ready to be passed to `i18next.init({ resources })`: the merged
 * catalog under {@link defaultNS}, and each area as its own namespace (see
 * `namespaces.ts`).
 */
function toResources(catalog: typeof en) {
  return {
    [defaultNS]: catalog,
    ...Object.fromEntries(namespaces.map((ns) => [ns, catalog[ns]])),
  };
}

export const resources = {
  en: toResources(en),
  es: toResources(es),
} as const;

export { en, es };
