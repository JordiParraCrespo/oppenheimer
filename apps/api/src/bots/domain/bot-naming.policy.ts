import { BOT_AVATAR_COLORS, BOT_NAME_MAX, type BotAvatarColor } from '@oppenheimer/shared';

/**
 * The name a new bot gets: the one asked for, or the next free "Name 2",
 * "Name 3"… when the workspace already has it (compared without case, as a
 * person reads the sidebar). The base is shortened so the number always fits.
 * Two creates at the same instant may both pick the same number; names are not
 * unique, so that is two bots with one name, which a rename fixes.
 */
export function uniqueBotName(base: string, taken: readonly string[]): string {
  const trimmed = base.trim();
  const used = new Set(taken.map((name) => name.trim().toLowerCase()));
  if (!used.has(trimmed.toLowerCase())) return trimmed;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const candidate = `${trimmed.slice(0, BOT_NAME_MAX - suffix.length).trimEnd()}${suffix}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

/** The colour a new bot is drawn on: the next of the eight, so neighbours differ. */
export function avatarColorFor(existingBots: number): BotAvatarColor {
  return BOT_AVATAR_COLORS[existingBots % BOT_AVATAR_COLORS.length];
}
