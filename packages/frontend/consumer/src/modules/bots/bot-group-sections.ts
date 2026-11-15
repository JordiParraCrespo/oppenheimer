import type { BotEntity, BotGroupEntity } from './bot.entity';

/**
 * One section of the Employees list, on the web and the phone: a group and
 * its bots, or the Ungrouped section (`group: null`) after every group, as
 * the design draws it.
 */
export interface BotGroupSection {
  /** The group's id; `null` for Ungrouped. */
  id: string | null;
  group: BotGroupEntity | null;
  bots: BotEntity[];
  /** How many of its bots are hidden and so not among `bots`. */
  hiddenCount: number;
}

/**
 * The Employees list's sections for a settled search: the groups in their order,
 * each with its bots by position, then Ungrouped. While a search narrows the
 * list a section with no match is left out; without one, every group stays
 * (an empty group is still somewhere to move a bot), and Ungrouped is drawn
 * only when it holds a bot, or with `keepUngrouped` (a drag held, for which
 * it is somewhere to drop one). A bot's group the groups read does not have
 * yet (a refetch in flight) counts as Ungrouped rather than vanishing. A bot
 * in `hidden` is left out, unless a search names it: a search is how a
 * hidden bot is found again.
 */
export function botGroupSections(
  bots: readonly BotEntity[],
  groups: readonly BotGroupEntity[],
  query: string,
  {
    keepUngrouped = false,
    hidden = [],
  }: { keepUngrouped?: boolean; hidden?: readonly string[] } = {},
): BotGroupSection[] {
  const term = query.trim().toLowerCase();
  const matches = (bot: BotEntity) =>
    term ? bot.name.toLowerCase().includes(term) : !hidden.includes(bot.id);
  const known = new Set(groups.map((group) => group.id));
  const hiddenIn = (groupId: string | null) =>
    term
      ? 0
      : bots.filter(
          (bot) =>
            hidden.includes(bot.id) &&
            (groupId === null
              ? bot.groupId === null || !known.has(bot.groupId)
              : bot.groupId === groupId),
        ).length;
  const byPosition = (a: BotEntity, b: BotEntity) => a.position - b.position;

  const sections: BotGroupSection[] = [...groups]
    .sort((a, b) => a.position - b.position)
    .map((group) => ({
      id: group.id,
      group,
      bots: bots.filter((bot) => bot.groupId === group.id && matches(bot)).sort(byPosition),
      hiddenCount: hiddenIn(group.id),
    }));
  const ungrouped = bots
    .filter((bot) => (bot.groupId === null || !known.has(bot.groupId)) && matches(bot))
    .sort(byPosition);
  sections.push({ id: null, group: null, bots: ungrouped, hiddenCount: hiddenIn(null) });

  return sections.filter((section) =>
    term || (section.group === null && !keepUngrouped) ? section.bots.length > 0 : true,
  );
}
