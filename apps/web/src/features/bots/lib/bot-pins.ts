import type { BotEntity } from '@oppenheimer/frontend-consumer';

/**
 * The bots the reader pinned to the top of the Employees sidebar, kept on
 * this device as the sessions sidebar keeps its pins: their ids, the most
 * recently pinned first. A pin is the reader's, not the bot's, so the API
 * never hears of it.
 */
export const BOT_PINS_KEY = 'oppenheimer.bots.pins';

/** The `SortableGroup` of the pinned bots, above the groups. */
export const PINNED_BOTS = 'pinned';

/** `pins` with `id` pinned on top, or taken out. */
export function withBotPin(pins: readonly string[], id: string, pinned: boolean): string[] {
  const rest = pins.filter((pinnedId) => pinnedId !== id);
  return pinned ? [id, ...rest] : rest;
}

/**
 * The pins a drop on Pinned left, in the order it left them, then the pins
 * it did not see (a bot not read yet) as they were.
 */
export function placedBotPins(dropped: readonly string[], pins: readonly string[]): string[] {
  const seen = new Set(dropped);
  return [...dropped, ...pins.filter((id) => !seen.has(id))];
}

/**
 * The pinned bots that match `query`, in pin order, and every bot that is
 * not pinned. A pin whose bot is not in `bots` (deleted) draws nothing.
 */
export function splitPinnedBots(
  bots: readonly BotEntity[],
  pins: readonly string[],
  query: string,
): { pinned: BotEntity[]; rest: BotEntity[] } {
  const term = query.trim().toLowerCase();
  const byId = new Map(bots.map((bot) => [bot.id, bot]));
  const pinned = pins
    .flatMap((id) => byId.get(id) ?? [])
    .filter((bot) => !term || bot.name.toLowerCase().includes(term));
  const set = new Set(pins);
  return { pinned, rest: bots.filter((bot) => !set.has(bot.id)) };
}

/**
 * Where a bot dropped in a group goes among every bot of that group, the
 * pinned ones it does not draw included, as the API's `position` counts
 * them. `drawn` is the group's rows after the drop. The bot goes right
 * after the row now above it, or right before the one below at the top, so
 * a pinned bot hidden between them keeps its place.
 */
export function positionInGroup(
  all: readonly BotEntity[],
  groupId: string | null,
  drawn: readonly string[],
  moved: string,
): number {
  const others = all
    .filter((bot) => (bot.groupId ?? null) === groupId && bot.id !== moved)
    .sort((a, b) => a.position - b.position)
    .map((bot) => bot.id);
  const at = drawn.indexOf(moved);
  const above = drawn[at - 1];
  if (above !== undefined && others.includes(above)) return others.indexOf(above) + 1;
  const below = drawn[at + 1];
  if (below !== undefined && others.includes(below)) return others.indexOf(below);
  return at <= 0 ? 0 : others.length;
}

/** What a drop in the Employees sidebar changes: the pins on this device, or the bot's place on the API. */
export type BotDrop =
  | { kind: 'pins'; pins: readonly string[] }
  | { kind: 'move'; unpin: boolean; groupId: string | null; position: number };

/**
 * The drop of bot `id` from group `from` to group `to`, `next` being every
 * group's ids after it. On Pinned it only re-pins in the order it left. Into
 * a group it is a move to the place among that group's bots, unpinning it
 * when it came out of Pinned.
 */
export function botDrop(
  { id, from, to }: { id: string; from: string; to: string },
  next: Readonly<Record<string, readonly string[]>>,
  bots: readonly BotEntity[],
  groupIdOf: (key: string) => string | null,
): BotDrop {
  if (to === PINNED_BOTS) return { kind: 'pins', pins: next[PINNED_BOTS] ?? [] };
  const groupId = groupIdOf(to);
  return {
    kind: 'move',
    unpin: from === PINNED_BOTS,
    groupId,
    position: positionInGroup(bots, groupId, next[to] ?? [], id),
  };
}
