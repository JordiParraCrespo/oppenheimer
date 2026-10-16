import { BOT_AVATAR_COLORS, BOT_NAME_MAX, type BotAvatarColor } from '@oppenheimer/shared';

/**
 * The first names a blank bot is born with (`25-bots.md` §1), in the order a
 * workspace meets them. Short, easy to say, no two with the same initial, so
 * neighbours in the sidebar read and draw apart, and none a product or
 * someone famous enough to be mistaken for one. A name says who the bot is;
 * its description says the job, which it writes itself in its first chat.
 */
export const BOT_FIRST_NAMES = [
  'Juno',
  'Milo',
  'Wren',
  'Iris',
  'Otto',
  'Sage',
  'Pip',
  'Hazel',
  'Quill',
  'Lark',
  'Fern',
  'Dex',
  'Clio',
  'Rune',
  'Tess',
  'Birch',
  'Vega',
  'Nell',
  'Gus',
  'Ember',
] as const;

/**
 * The name of a bot created without one: the first of `BOT_FIRST_NAMES` the
 * workspace does not have, starting from the one its bot count points at, so
 * a workspace's bots walk the list in order. Once every name is taken the
 * list starts over, numbered ("Juno 2").
 */
export function firstNameFor(taken: readonly string[]): string {
  const used = new Set(taken.map((name) => name.trim().toLowerCase()));
  const start = taken.length % BOT_FIRST_NAMES.length;
  for (let i = 0; i < BOT_FIRST_NAMES.length; i++) {
    const name = BOT_FIRST_NAMES[(start + i) % BOT_FIRST_NAMES.length];
    if (!used.has(name.toLowerCase())) return name;
  }
  return uniqueBotName(BOT_FIRST_NAMES[start], taken);
}

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
