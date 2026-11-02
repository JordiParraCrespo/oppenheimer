import en from '@oppenheimer/translations/en/extension.json';
import es from '@oppenheimer/translations/es/extension.json';

/**
 * The extension's words, from `@oppenheimer/translations` (`extension.json`):
 * one catalog for the popup, the worker's notifications and badge, and
 * Chrome's own listing (`_locales/`, which the build writes from `chrome`).
 */
export const CATALOGS = { en, es } as const;
export type Language = keyof typeof CATALOGS;
