import type { BotEntity, BotGroupEntity } from '@oppenheimer/frontend-consumer';

/**
 * One section of the Employees sidebar: a group and its bots, or the
 * Ungrouped section (`group: null`) after every group, as the design draws it.
 */
export interface BotSection {
  /** The group's id; `null` for Ungrouped. */
  id: string | null;
  group: BotGroupEntity | null;
  bots: BotEntity[];
}

/**
 * The sidebar's sections for a settled search: the groups in their order,
 * each with its bots by position, then Ungrouped. While a search narrows the
 * list a section with no match is left out; without one, every group stays
 * (an empty group is still somewhere to move a bot), and Ungrouped is drawn
 * only when it holds a bot. A bot's group the groups read does not have yet
 * (a refetch in flight) counts as Ungrouped rather than vanishing.
 */
export function botSections(
  bots: readonly BotEntity[],
  groups: readonly BotGroupEntity[],
  query: string,
): BotSection[] {
  const term = query.trim().toLowerCase();
  const matches = (bot: BotEntity) => !term || bot.name.toLowerCase().includes(term);
  const known = new Set(groups.map((group) => group.id));
  const byPosition = (a: BotEntity, b: BotEntity) => a.position - b.position;

  const sections: BotSection[] = [...groups]
    .sort((a, b) => a.position - b.position)
    .map((group) => ({
      id: group.id,
      group,
      bots: bots.filter((bot) => bot.groupId === group.id && matches(bot)).sort(byPosition),
    }));
  const ungrouped = bots
    .filter((bot) => (bot.groupId === null || !known.has(bot.groupId)) && matches(bot))
    .sort(byPosition);
  sections.push({ id: null, group: null, bots: ungrouped });

  return sections.filter((section) =>
    term || section.group === null ? section.bots.length > 0 : true,
  );
}

/** The bot the sidebar draws first, in its groups' order then Ungrouped; undefined with none. */
export function firstBot(
  bots: readonly BotEntity[],
  groups: readonly BotGroupEntity[],
): BotEntity | undefined {
  return botSections(bots, groups, '').flatMap((section) => section.bots)[0];
}
