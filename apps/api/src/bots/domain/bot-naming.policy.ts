import { BOT_AVATAR_COLORS, BOT_NAME_MAX, type BotAvatarColor } from '@oppenheimer/shared';

/**
 * The first names a blank bot is born with: physicists, in keeping with the
 * product's name (the owner's pick). Surnames, short and easy to say, no two
 * with the same initial, so neighbours in the sidebar read and draw apart, and
 * none that is also a product or a company. A name says who the bot is; its
 * description says the job, which it writes itself in its first chat, and it
 * offers a name of its own there too.
 */
export const BOT_FIRST_NAMES = [
  'Alvarez',
  'Bohr',
  'Curie',
  'Dirac',
  'Feynman',
  'Gauss',
  'Hawking',
  'Joule',
  'Kepler',
  'Lorentz',
  'Meitner',
  'Noether',
  'Ohm',
  'Planck',
  'Rubin',
  'Salam',
  'Thomson',
  'Volta',
  'Wu',
  'Zwicky',
] as const;

/**
 * The name of a bot created without one: one of `BOT_FIRST_NAMES` the
 * workspace does not have, picked at random, so two workspaces do not both
 * start with the same bot (it was the first free one in order, so every
 * workspace's first bot was Juno). Once every name is taken, a random one is
 * numbered ("Feynman 2").
 */
export function firstNameFor(taken: readonly string[]): string {
  const used = new Set(taken.map((name) => name.trim().toLowerCase()));
  const free = BOT_FIRST_NAMES.filter((name) => !used.has(name.toLowerCase()));
  if (free.length > 0) return pick(free);
  return uniqueBotName(pick(BOT_FIRST_NAMES), taken);
}

function pick<T>(from: readonly T[]): T {
  return from[Math.floor(Math.random() * from.length)] as T;
}

/** A new bot's name: the one asked for, numbered if taken, or the next first name. */
export function nameForNewBot(asked: string | undefined, taken: readonly string[]): string {
  return asked ? uniqueBotName(asked, taken) : firstNameFor(taken);
}

/**
 * The name a new bot gets when one is asked for: that one, or the next free "Name 2",
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
