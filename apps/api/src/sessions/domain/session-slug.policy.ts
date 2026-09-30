import { randomInt } from 'node:crypto';

/**
 * A session's slug: `<adjective>-<noun>-<6 base36>`.
 *
 * Minted at create, before anything is typed, because the directory and branch must
 * exist first, and a directory name is never reused, so a name-derived slug would
 * get no second try. The shape is the one Claude Code on the web gives its branches
 * (`claude/amazing-clarke-p631o4`): opaque enough to be a path, pronounceable enough
 * to say out loud.
 *
 * The display name starts as the slug and is replaced by a title from the first
 * prompt; the slug never changes (`product/versions/mvp/03-control-plane.md`).
 */

/**
 * Curated rather than generated: every word is short, lower-case, unambiguous
 * when read aloud, and safe as a directory name and a git ref. A word list in a
 * file is also the only form a reviewer can check — a dictionary dependency
 * would put "which words can this product print" outside the repository.
 */
const ADJECTIVES = [
  'amber',
  'bold',
  'brave',
  'bright',
  'calm',
  'clever',
  'crisp',
  'eager',
  'fair',
  'gentle',
  'glad',
  'keen',
  'lively',
  'lucid',
  'merry',
  'mild',
  'noble',
  'quiet',
  'rapid',
  'ready',
  'sharp',
  'solid',
  'spry',
  'steady',
  'stout',
  'sunny',
  'swift',
  'tidy',
  'vivid',
  'warm',
  'wise',
  'witty',
] as const;

const NOUNS = [
  'alder',
  'badger',
  'beacon',
  'cedar',
  'comet',
  'coral',
  'delta',
  'ember',
  'falcon',
  'fjord',
  'harbor',
  'heron',
  'ibis',
  'juniper',
  'lantern',
  'lark',
  'maple',
  'marlin',
  'meadow',
  'orchid',
  'otter',
  'pebble',
  'quartz',
  'raven',
  'ridge',
  'river',
  'sable',
  'sparrow',
  'summit',
  'thistle',
  'willow',
  'wren',
] as const;

/** Six base36 characters: 2.1 billion per adjective/noun pair. */
const SUFFIX_LENGTH = 6;
const SUFFIX_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * What a slug must look like, wherever one arrives from. Lower-case words and
 * digits joined by single dashes, because it is a directory on every host that
 * holds the session and a segment of its git branch.
 */
export const SESSION_SLUG_PATTERN = /^[a-z]+-[a-z]+-[0-9a-z]{6}$/;

/** The randomness is `node:crypto`'s, not `Math.random`'s. */
export function mintSessionSlug(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const noun = NOUNS[randomInt(NOUNS.length)];
  let suffix = '';
  for (let index = 0; index < SUFFIX_LENGTH; index += 1) {
    suffix += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
  }
  return `${adjective}-${noun}-${suffix}`;
}
