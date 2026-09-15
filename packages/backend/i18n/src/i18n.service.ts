import { Inject, Injectable } from '@nestjs/common';
import { Formatter } from './formatter';
import { I18N_OPTIONS, type I18nModuleOptions } from './i18n.options';
import { Translator } from './translator';
import type { DayBucket, FormatOptions, TranslationVars, ValueFormat } from './types';

/**
 * A translator bound to one locale and timezone.
 *
 * Rendering code takes one of these rather than passing `(locale, timezone)`
 * through every call: it makes "which locale is this string in?" unanswerable
 * by accident, and it means a renderer cannot mix two readers' settings inside
 * one response.
 */
export class LocalizedFormatter {
  constructor(
    readonly locale: string,
    readonly timeZone: string,
    private readonly translator: Translator,
    private readonly formatter: Formatter,
    private readonly now: () => Date,
  ) {}

  t(key: string, vars: TranslationVars = {}): string {
    return this.translator.t(this.locale, key, vars);
  }

  optional(key: string, vars: TranslationVars = {}): string | undefined {
    return this.translator.optional(this.locale, key, vars);
  }

  format(value: unknown, format: ValueFormat = 'text', options: FormatOptions = {}): string {
    return this.formatter.format(this.locale, value, format, {
      timeZone: this.timeZone,
      now: this.now(),
      ...options,
    });
  }

  /** The compact list-column stamp: `12m`, `2h`, `1d`. */
  relativeShort(value: Date): string {
    const { unit, count } = this.formatter.relativeParts(value, this.now());
    return this.t(`common.relative.${unit}`, { count });
  }

  /** The long form used inside body copy: "2 hours ago". */
  relativeLong(value: Date): string {
    return this.formatter.relative(this.locale, value, this.now());
  }

  dayBucket(value: Date): DayBucket {
    return this.formatter.dayBucket(value, this.now(), this.timeZone);
  }

  isoDay(value: Date): string {
    return this.formatter.isoDay(value, this.timeZone);
  }
}

/**
 * The injectable entry point. Owns the bundles, hands out {@link
 * LocalizedFormatter}s bound to a resolved locale.
 */
@Injectable()
export class I18nService {
  private readonly translator: Translator;
  private readonly formatter = new Formatter();
  private readonly defaultTimeZone: string;
  private readonly now: () => Date;

  constructor(@Inject(I18N_OPTIONS) options: I18nModuleOptions) {
    this.translator = new Translator(options.bundles, {
      defaultLocale: options.defaultLocale,
      onMissingKey: options.onMissingKey,
    });
    this.defaultTimeZone = options.defaultTimeZone ?? 'UTC';
    // Injectable so tests can freeze time without stubbing globals.
    this.now = options.now ?? (() => new Date());
  }

  get locales(): readonly string[] {
    return this.translator.locales();
  }

  supports(locale: string | null | undefined): boolean {
    return this.translator.supports(locale);
  }

  /**
   * Pick the first candidate with a bundle, falling back to the default.
   *
   * Callers pass the chain in priority order — explicit query parameter, then
   * `Accept-Language`, then the user's stored preference, then the
   * organization's default — and get back a locale that is guaranteed to
   * render.
   */
  negotiate(...candidates: (string | null | undefined)[]): string {
    return this.translator.negotiate(...candidates);
  }

  /** A formatter bound to an already-resolved locale and timezone. */
  for(locale: string, timeZone?: string | null): LocalizedFormatter {
    return new LocalizedFormatter(
      locale,
      timeZone ?? this.defaultTimeZone,
      this.translator,
      this.formatter,
      this.now,
    );
  }

  /** Escape hatch for code that needs the raw lookup (boot-time key checks). */
  has(locale: string, key: string): boolean {
    return this.translator.has(locale, key);
  }
}
