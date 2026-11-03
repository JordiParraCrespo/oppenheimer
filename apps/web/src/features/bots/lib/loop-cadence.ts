/** The words for how often a loop runs, by the unit its interval is in (`bots.chat.loop.every.*`). */
const CADENCE_KEYS = {
  minutes: 'bots.chat.loop.every.minutes',
  hours: 'bots.chat.loop.every.hours',
  days: 'bots.chat.loop.every.days',
  selfPaced: 'bots.chat.loop.every.selfPaced',
} as const;

/**
 * How often a loop runs, as the console words it (`25-bots.md` §4.1,
 * `/loop`): the largest whole unit its interval is in ("every 2 hours",
 * "every 90 minutes"), or the bot's own pace when it has none. The key and
 * the count to give `t`.
 */
export function loopCadenceOf(intervalMinutes: number | null): {
  key: (typeof CADENCE_KEYS)[keyof typeof CADENCE_KEYS];
  count: number;
} {
  if (intervalMinutes === null) return { key: CADENCE_KEYS.selfPaced, count: 0 };
  if (intervalMinutes % 1_440 === 0) {
    return { key: CADENCE_KEYS.days, count: intervalMinutes / 1_440 };
  }
  if (intervalMinutes % 60 === 0) return { key: CADENCE_KEYS.hours, count: intervalMinutes / 60 };
  return { key: CADENCE_KEYS.minutes, count: intervalMinutes };
}
