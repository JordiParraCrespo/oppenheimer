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
