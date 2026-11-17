import type { CalendarAccent, CalendarEntryKind } from '../components/month-calendar';

/**
 * The colour a calendar entry wears, so the month, the day and the week can
 * be read at a glance: the calendar it came from when it has one (a Google
 * account), else its kind's (events blue, tasks violet, automation runs
 * amber). Each class sets `--tone`; the entry tints its wash, its edge and
 * its glyph from it.
 */
const KIND_TONE: Record<CalendarEntryKind, CalendarAccent> = {
  event: 'chart-1',
  task: 'chart-3',
  automation: 'chart-5',
};

const TONE_VAR: Record<CalendarAccent, string> = {
  'chart-1': '[--tone:var(--chart-1)]',
  'chart-2': '[--tone:var(--chart-2)]',
  'chart-3': '[--tone:var(--chart-3)]',
  'chart-4': '[--tone:var(--chart-4)]',
  'chart-5': '[--tone:var(--chart-5)]',
};

function toneOf(entry: { kind: CalendarEntryKind; accent?: CalendarAccent }): CalendarAccent {
  return entry.accent ?? KIND_TONE[entry.kind];
}

/** The class that sets an entry's `--tone`. */
function toneClass(entry: { kind: CalendarEntryKind; accent?: CalendarAccent }): string {
  return TONE_VAR[toneOf(entry)];
}

/**
 * How deep an entry's wash is, on the card: `soft` for a busy event, a task
 * or a run; `strong` for an all-day event, which stands for the whole day;
 * `free` for time that is not blocked. Each deepens on hover.
 */
const TONE_WASH = {
  soft: 'bg-[color-mix(in_oklab,var(--tone)_13%,var(--card))] hover:bg-[color-mix(in_oklab,var(--tone)_21%,var(--card))]',
  strong:
    'bg-[color-mix(in_oklab,var(--tone)_24%,var(--card))] hover:bg-[color-mix(in_oklab,var(--tone)_32%,var(--card))]',
  free: 'bg-[color-mix(in_oklab,var(--tone)_5%,var(--card))] hover:bg-[color-mix(in_oklab,var(--tone)_12%,var(--card))]',
} as const;

export { KIND_TONE, TONE_WASH, toneClass };
