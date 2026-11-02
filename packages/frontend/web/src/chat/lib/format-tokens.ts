const formats = new Map<string, Intl.NumberFormat>();

/** A token count as people read it ("32K", "1M"); one formatter per locale. */
export function formatTokens(tokens: number, locale: string): string {
  let format = formats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
    formats.set(locale, format);
  }
  return format.format(tokens);
}
