/**
 * A locale's message catalog: an arbitrarily nested tree of strings, addressed
 * by dotted key path (`emails.invitation.roles.admin`).
 *
 * Structural rather than a named import of the app's bundles: the package
 * translates, it does not own copy (see `I18nModuleOptions.bundles`).
 */
export type MessageNode = string | { [key: string]: MessageNode };
export type MessageBundle = Record<string, MessageNode>;

/** Values interpolated into `{{placeholders}}`. */
export type TranslationVars = Record<string, string | number | null | undefined>;

/** Bundles keyed by locale tag, e.g. `{ en: {...}, es: {...} }`. */
export type MessageBundles = Readonly<Record<string, MessageBundle>>;

/** The formats `Formatter.format` accepts by name. */
export type ValueFormat =
  | 'text'
  | 'number'
  | 'percent'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'relative';

export interface FormatOptions {
  /** ISO 4217 code. Required by `currency`, ignored otherwise. */
  currency?: string;
  /** IANA zone the date formats in. Defaults to UTC. */
  timeZone?: string;
  /** Reference instant for `relative`. Defaults to now. */
  now?: Date;
}

/** The coarse day headings `Formatter.dayBucket` sorts an instant into. */
export type DayBucket = 'today' | 'yesterday' | 'earlier';

/**
 * A relative time decomposed into a unit and a count, so the *label* can live
 * in the copy tree (`{{count}}m`) rather than being assembled here. Spanish may
 * want `12min` where English wants `12m`, and that is a translator's call.
 */
export interface RelativeParts {
  unit: 'now' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  count: number;
}
