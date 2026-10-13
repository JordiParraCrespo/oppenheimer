/**
 * Stats' number formats, one cached `Intl.NumberFormat` per locale and style:
 * a formatter is costly to build and pure, so render never builds one.
 */
const cache = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let format = cache.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, options);
    cache.set(key, format);
  }
  return format;
}

/** `1.2M`, `340K`: a token count at a glance. */
export function formatCompact(value: number, locale: string): string {
  return formatter(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** `$1,204` or, under ten dollars, `$4.20`. */
export function formatUsd(value: number, locale: string): string {
  return formatter(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 10 ? 2 : 0,
  }).format(value);
}
