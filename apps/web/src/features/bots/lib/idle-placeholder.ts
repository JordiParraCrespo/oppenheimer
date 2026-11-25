/**
 * What the empty composer invites, one line among several so the box does
 * not read the same every time it opens.
 */
const IDLE_PLACEHOLDERS = ['takeOn', 'job', 'problem', 'session', 'listening', 'anything'] as const;

/** The same while a turn runs: a line that invites steering, not a list of keys. */
const RUNNING_PLACEHOLDERS = ['steer', 'nudge', 'context', 'next', 'course'] as const;

function pick<T>(lines: readonly [T, ...T[]], roll: number): T {
  const index = Math.min(Math.floor(roll * lines.length), lines.length - 1);
  // The index is in range; the fallback only satisfies noUncheckedIndexedAccess.
  return lines[index] ?? lines[0];
}

/**
 * The placeholder's translation key for this visit, from `roll` in [0, 1):
 * the composer draws the roll once when it mounts, and it mounts again for
 * each bot, so a visit keeps one idle line and one running line.
 */
export function placeholderKey(running: boolean, roll: number) {
  return running
    ? (`bots.chat.placeholdersRunning.${pick(RUNNING_PLACEHOLDERS, roll)}` as const)
    : (`bots.chat.placeholders.${pick(IDLE_PLACEHOLDERS, roll)}` as const);
}
