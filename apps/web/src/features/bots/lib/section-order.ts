import type { BotEntity } from '@oppenheimer/frontend-consumer';

/** Where a bot goes in the Employees order: the group and its index there, as the API takes them. */
export interface BotPlacement {
  groupId: string | null;
  position: number;
}

/**
 * Where a bot dragged within a section's Bots heading goes in the Employees
 * order, which every list of bots draws (a section lists the bots placed in
 * it, in that order; `28-bots-in-sections.md`). `listed` is the section's
 * ids after the drop and `all` every bot in the Employees order. The bot goes
 * right after the one now above it, or right before the one now below it, so
 * it is drawn between the same two bots here and in Employees. A neighbour in
 * its own group is taken first, so it changes group only when neither is in
 * it, and then joins the one above (the one below at the top). `null` when
 * it has no neighbour, alone in the section.
 */
export function placementInSection(
  all: readonly BotEntity[],
  listed: readonly string[],
  moved: string,
): BotPlacement | null {
  const byId = new Map(all.map((bot) => [bot.id, bot]));
  const bot = byId.get(moved);
  const at = listed.indexOf(moved);
  if (!bot || at === -1) return null;
  const above = byId.get(listed[at - 1] ?? '');
  const below = byId.get(listed[at + 1] ?? '');

  const anchor =
    above?.groupId === bot.groupId
      ? { beside: above, after: true }
      : below?.groupId === bot.groupId
        ? { beside: below, after: false }
        : above
          ? { beside: above, after: true }
          : below
            ? { beside: below, after: false }
            : null;
  if (!anchor) return null;

  const { groupId } = anchor.beside;
  const mates = all.filter((each) => each.groupId === groupId && each.id !== moved);
  const index = mates.findIndex((each) => each.id === anchor.beside.id);
  return { groupId, position: index + (anchor.after ? 1 : 0) };
}
