/**
 * What the empty composer invites, one line among several so the box does
 * not read the same every time it opens.
 */
export const IDLE_PLACEHOLDERS = [
  'takeOn',
  'job',
  'problem',
  'session',
  'listening',
  'anything',
] as const;

export type IdlePlaceholder = (typeof IDLE_PLACEHOLDERS)[number];

/**
 * The line for this visit, from `roll` in [0, 1): the composer draws it once
 * when it mounts, and it mounts again for each bot.
 */
export function idlePlaceholder(roll: number): IdlePlaceholder {
  const index = Math.min(Math.floor(roll * IDLE_PLACEHOLDERS.length), IDLE_PLACEHOLDERS.length - 1);
  // The index is in range; the fallback only satisfies noUncheckedIndexedAccess.
  return IDLE_PLACEHOLDERS[index] ?? IDLE_PLACEHOLDERS[0];
}

/** The placeholder's translation key: Steer while a turn runs, otherwise the visit's line. */
export function placeholderKey(running: boolean, idle: IdlePlaceholder) {
  return running
    ? ('bots.chat.placeholderRunning' as const)
    : (`bots.chat.placeholders.${idle}` as const);
}
