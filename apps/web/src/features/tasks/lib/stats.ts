import { addDays, daysBetween, searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/**
 * Plan's Stats period and the arithmetic over its numbers
 * (`23-plan-milestones-stats-accounts.md` §4). The period lives in the address:
 * a preset, or a custom `from`/`to`; comparing with the period before is the
 * default, `?compare=off` turns it off.
 */
export const STATS_PRESETS = ['7d', '4w', '8w', '12w', 'qtd', 'ytd'] as const;
export type StatsPreset = (typeof STATS_PRESETS)[number];
const DEFAULT_STATS_PRESET: StatsPreset = '8w';

export const statsSearchSchema = z.object({
  project: searchText,
  range: z.enum(STATS_PRESETS).optional().catch(undefined),
  from: searchText,
  to: searchText,
  compare: z.literal('off').optional().catch(undefined),
});
export type StatsSearch = z.infer<typeof statsSearchSchema>;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The days a preset covers, ending today. */
export function presetRange(preset: StatsPreset, today: string): { from: string; to: string } {
  const back = { '7d': 6, '4w': 27, '8w': 55, '12w': 83 } as const;
  if (preset in back)
    return { from: addDays(today, -back[preset as keyof typeof back]), to: today };
  if (preset === 'qtd') {
    const month = Number(today.slice(5, 7));
    const first = String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, '0');
    return { from: `${today.slice(0, 4)}-${first}-01`, to: today };
  }
  return { from: `${today.slice(0, 4)}-01-01`, to: today };
}

/**
 * The period the address names: a custom range when both ends are real days
 * in order and no later than today, else the preset (eight weeks by default).
 */
export function resolveStatsPeriod(
  search: StatsSearch,
  today: string,
): { from: string; to: string; preset: StatsPreset | null } {
  const { from, to } = search;
  if (from && to && ISO_DAY.test(from) && ISO_DAY.test(to) && from <= to && to <= today) {
    if (daysBetween(from, to) < 371) return { from, to, preset: null };
  }
  const preset = search.range ?? DEFAULT_STATS_PRESET;
  return { ...presetRange(preset, today), preset };
}

/**
 * A change against the period before, as a sign and a percentage, and whether
 * that direction is good: more tasks done is good, more cost is not, tokens
 * are neither. No previous figure, no delta.
 */
export function deltaOf(
  current: number | null,
  previous: number | null | undefined,
  better: 'up' | 'down' | 'none',
): { value: string; tone: 'good' | 'bad' | 'flat' } | null {
  if (current === null || previous === null || previous === undefined) return null;
  if (previous === 0) return current === 0 ? { value: '0%', tone: 'flat' } : null;
  const change = Math.round(((current - previous) / previous) * 100);
  const value = `${change > 0 ? '+' : change < 0 ? '−' : ''}${Math.abs(change)}%`;
  if (change === 0 || better === 'none') return { value, tone: 'flat' };
  return { value, tone: change > 0 === (better === 'up') ? 'good' : 'bad' };
}

/** Five evenly spaced, round ticks from zero that cover `max`. */
export function ticksFor(max: number): number[] {
  if (max <= 0) return [0, 1, 2, 3, 4];
  const raw = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  return [0, 1, 2, 3, 4].map((i) => Number((i * step).toPrecision(6)));
}
