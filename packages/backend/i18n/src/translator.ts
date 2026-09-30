import type { MessageBundle, MessageBundles, MessageNode, TranslationVars } from './types';

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Suffixes a plural-aware key may carry, matching the i18next convention. */
const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

export interface TranslatorOptions {
  /** Locale used when the requested one has no entry. */
  defaultLocale?: string;
  /** Called once per missing key per process. Defaults to a `console.warn`. */
  onMissingKey?: (locale: string, key: string) => void;
}

/**
 * Dotted-key message lookup with interpolation and plural selection.
 *
 * Deliberately not i18next: the server needs a fraction of it, and a small
 * implementation that never throws is worth more here than a feature-complete
 * one that can. **`t()` always returns a string** — a missing
 * key renders its own path, which is ugly in a way that gets noticed and
 * fixed, where a thrown error would take down a whole page over one
 * untranslated string.
 */
export class Translator {
  private readonly bundles: MessageBundles;
  private readonly defaultLocale: string;
  private readonly warned = new Set<string>();
  /**
   * One `Intl.PluralRules` per locale: building one costs microseconds and an
   * allocation, on render paths that loop over items. `null` records a locale
   * the runtime rejected, so it falls back without throwing every time.
   */
  private readonly pluralRules = new Map<string, Intl.PluralRules | null>();
  private readonly onMissingKey: (locale: string, key: string) => void;

  constructor(bundles: MessageBundles, options: TranslatorOptions = {}) {
    this.bundles = bundles;
    this.defaultLocale = options.defaultLocale ?? 'en';
    this.onMissingKey =
      options.onMissingKey ??
      ((locale, key) => {
        console.warn(`[i18n] missing translation "${key}" for locale "${locale}"`);
      });
  }

  private supports(locale: string | null | undefined): boolean {
    return !!locale && locale in this.bundles;
  }

  /**
   * Resolve the first candidate that has a bundle.
   *
   * Candidates are tried whole (`es-ES`) and then by their primary subtag
   * (`es`), which is what makes an `Accept-Language: es-ES,es;q=0.9` header
   * land on the `es` bundle instead of falling through to English.
   */
  negotiate(...candidates: (string | null | undefined)[]): string {
    for (const candidate of candidates) {
      if (!candidate) continue;
      const tag = candidate.trim();
      if (this.supports(tag)) return tag;
      const primary = tag.split('-')[0]?.toLowerCase();
      if (this.supports(primary)) return primary as string;
    }
    return this.defaultLocale;
  }

  /** Whether a key resolves to a string in the given locale (no fallback). */
  has(locale: string, key: string): boolean {
    return typeof this.lookup(this.bundles[locale], key) === 'string';
  }

  /**
   * Pass `count` in `vars` to select a plural form: the lookup then prefers
   * `<key>_one` / `<key>_other` (whatever `Intl.PluralRules` selects for the
   * locale) and falls back to the bare key.
   */
  t(locale: string, key: string, vars: TranslationVars = {}): string {
    const template = this.resolveTemplate(locale, key, vars.count);

    if (template === undefined) {
      this.warnOnce(locale, key);
      return key;
    }

    return this.interpolate(template, vars);
  }

  /**
   * Like {@link t}, but returns `undefined` instead of the key path when the
   * message does not exist. For optional copy (an invitation's localized role
   * name, which falls back to the raw role), where "absent" is a real state the
   * caller wants to branch on.
   */
  optional(locale: string, key: string, vars: TranslationVars = {}): string | undefined {
    const template = this.resolveTemplate(locale, key, vars.count);
    return template === undefined ? undefined : this.interpolate(template, vars);
  }

  private resolveTemplate(
    locale: string,
    key: string,
    count: string | number | null | undefined,
  ): string | undefined {
    const keys = typeof count === 'number' ? [...this.pluralKeys(locale, key, count), key] : [key];

    for (const bundle of [this.bundles[locale], this.bundles[this.defaultLocale]]) {
      if (!bundle) continue;
      for (const candidate of keys) {
        const found = this.lookup(bundle, candidate);
        if (typeof found === 'string') return found;
      }
    }

    return undefined;
  }

  /** `<key>_one` for the selected category, then `_other` as the safety net. */
  private pluralKeys(locale: string, key: string, count: number): string[] {
    const rules = this.pluralRulesFor(locale);
    const category = rules ? rules.select(count) : count === 1 ? 'one' : 'other';

    const ordered = [category, 'other'].filter((suffix) =>
      (PLURAL_SUFFIXES as readonly string[]).includes(suffix),
    );

    return [...new Set(ordered)].map((suffix) => `${key}_${suffix}`);
  }

  private pluralRulesFor(locale: string): Intl.PluralRules | null {
    let rules = this.pluralRules.get(locale);
    if (rules === undefined) {
      try {
        rules = new Intl.PluralRules(locale);
      } catch {
        rules = null;
      }
      this.pluralRules.set(locale, rules);
    }
    return rules;
  }

  private lookup(bundle: MessageBundle | undefined, key: string): MessageNode | undefined {
    if (!bundle) return undefined;

    let node: MessageNode | undefined = bundle;
    for (const segment of key.split('.')) {
      if (typeof node !== 'object' || node === null) return undefined;
      node = node[segment];
    }
    return node;
  }

  /**
   * Replace `{{name}}` with its value. An unknown placeholder renders empty
   * rather than leaking the token into the UI — copy and payload evolve
   * independently, and a stale placeholder should degrade to a gap, not to
   * something that looks like a bug in the reader's data.
   */
  private interpolate(template: string, vars: TranslationVars): string {
    return template.replace(PLACEHOLDER, (_match, name: string) => {
      const value = vars[name];
      return value === undefined || value === null ? '' : String(value);
    });
  }

  private warnOnce(locale: string, key: string): void {
    const marker = `${locale}:${key}`;
    if (this.warned.has(marker)) return;
    this.warned.add(marker);
    this.onMissingKey(locale, key);
  }
}
