import type { VisualNumberFormat } from '@oppenheimer/shared/schemas/visual';

/**
 * A number as a visual reads it: grouped for the reader's locale, with the
 * spec's prefix and suffix, its decimals (or the number's own, up to two)
 * and, when asked, compact ("1.2k"). A minus is the typographic one.
 */
export function formatVisualNumber(
  value: number,
  format: VisualNumberFormat | undefined,
  locale?: string,
): string {
  const decimals = format?.decimals;
  const body = new Intl.NumberFormat(locale, {
    notation: format?.compact ? 'compact' : 'standard',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals ?? (format?.compact ? 1 : 2),
  })
    .format(Math.abs(value))
    .trim();
  const sign = value < 0 ? '−' : '';
  return `${sign}${format?.prefix ?? ''}${body}${format?.suffix ?? ''}`;
}

/** A change as a signed figure: "+6", "−2.5%", "0". */
export function formatVisualDelta(
  value: number,
  format: VisualNumberFormat | undefined,
  locale?: string,
): string {
  const plain = formatVisualNumber(Math.abs(value), format, locale);
  if (value > 0) return `+${plain}`;
  if (value < 0) return `−${plain}`;
  return plain;
}

/**
 * Round ticks from zero (or the lowest value, when it is under zero) to just
 * over the highest: a step of 1, 2, 2.5 or 5 times a power of ten, four or five
 * rules in all, so the axis reads 0, 25, 50, 75, 100 and never 0, 23, 46.
 */
export function niceTicks(values: readonly number[], count = 4): number[] {
  const finite = values.filter(Number.isFinite);
  const low = Math.min(0, ...finite);
  const high = Math.max(0, ...finite);
  if (high === low) return [low, low + 1];
  const raw = (high - low) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * power >= raw) ?? 10) * power;
  const start = Math.floor(low / step) * step;
  const ticks: number[] = [];
  for (let tick = start; tick < high + step * 0.999; tick += step) {
    ticks.push(Number(tick.toPrecision(12)));
  }
  return ticks;
}

/** The categorical chart tones, in order: the nth series takes the nth. */
const VISUAL_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const;

export type VisualSeriesTone = (typeof VISUAL_TONES)[number];

export function seriesTone(index: number): VisualSeriesTone {
  return VISUAL_TONES[index % VISUAL_TONES.length] ?? 'chart-1';
}

/**
 * Items with a key from what they say, a duplicate numbered after the first
 * ("CI", "CI·2"): stable while the agent's list stays the same, and never the
 * bare index.
 */
export function keyed<Item>(
  items: readonly Item[],
  name: (item: Item) => string,
): { item: Item; key: string }[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = name(item);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return { item, key: count === 1 ? base : `${base}·${count}` };
  });
}
