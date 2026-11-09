const formats = new Map<string, Intl.NumberFormat>();

/**
 * An agent's cost in dollars as people read it ("$177", "$3.85"); one
 * formatter per locale. The console shows money nowhere else yet: it moves to
 * the kit, beside `formatTokens`, when a second surface does.
 */
export function formatUsd(amount: number, locale: string): string {
  let format = formats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
    formats.set(locale, format);
  }
  return format.format(amount);
}
