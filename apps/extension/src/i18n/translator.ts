import i18next, { type i18n, type Module, type TFunction } from 'i18next';
import type { SessionReason } from '@/sessions/session';
import { CATALOGS, type Language } from './catalogs';

/** The reader's language, as Chrome reports it, among the ones there is copy for. */
export function languageOf(tag: string): Language {
  return tag.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/**
 * A translator, ready at once: the catalogs are bundled, so nothing is
 * fetched. Each page and the worker build their own; `plugins` is the
 * popup's React binding.
 */
export function createTranslator(tag: string, plugins: Module[] = []): i18n {
  const instance = i18next.createInstance();
  for (const plugin of plugins) instance.use(plugin);
  void instance.init({
    resources: { en: { extension: CATALOGS.en }, es: { extension: CATALOGS.es } },
    lng: languageOf(tag),
    fallbackLng: 'en',
    ns: ['extension'],
    defaultNS: 'extension',
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return instance;
}

/** A session's reason in the reader's words; the server's own words stay as it gave them. */
export function reasonText(t: TFunction, reason: SessionReason | null): string | null {
  if (!reason) return null;
  if (reason.code === 'detail') return reason.text;
  if (reason.code === 'tool') return t('reason.tool', { tool: reason.tool });
  return t(`reason.${reason.code}`);
}
