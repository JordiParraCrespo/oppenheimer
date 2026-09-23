import type { MessageBundles } from './types';

/** DI token carrying the options `I18nModule.forRoot()` was configured with. */
export const I18N_OPTIONS = Symbol('I18N_OPTIONS');

export interface I18nModuleOptions {
  /**
   * Message bundles keyed by locale.
   *
   * Supplied by the application, not imported by this package: the same JSON
   * the web app loads is the one the server renders from, so a
   * string is written once and a translator edits one file.
   */
  bundles: MessageBundles;
  /** Locale used when nothing else resolves. Defaults to `en`. */
  defaultLocale?: string;
  /** IANA zone used when neither the user nor the organization set one. */
  defaultTimeZone?: string;
  /** Called once per missing key per process. */
  onMissingKey?: (locale: string, key: string) => void;
  /** Clock seam, so tests can render relative times deterministically. */
  now?: () => Date;
}
