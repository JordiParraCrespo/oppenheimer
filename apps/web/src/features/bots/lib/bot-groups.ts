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

/** The key a section is dragged and folded by; Ungrouped has no id of its own. */
const UNGROUPED = 'ungrouped';

export function sectionKey(section: BotSection): string {
  return section.id ?? UNGROUPED;
}

/** The group a section key names for the API: `null` for Ungrouped. */
export function groupIdOf(key: string): string | null {
  return key === UNGROUPED ? null : key;
}

/** Each section's bot ids, by its key: the value the drag layer moves. */
export function sectionOrder(sections: readonly BotSection[]): Record<string, string[]> {
  return Object.fromEntries(
    sections.map((section) => [sectionKey(section), section.bots.map((bot) => bot.id)]),
  );
}

/**
 * The sections with their bots in `order` (a drag held, or a drop whose
 * write is in flight): a bot is drawn in the section and place `order` puts
 * it. A bot `order` does not name stays where it was; an id `order` names
 * that is no longer a bot is skipped.
 */
export function inOrder(
  sections: readonly BotSection[],
  order: Readonly<Record<string, readonly string[]>>,
): BotSection[] {
  const byId = new Map(sections.flatMap((section) => section.bots.map((bot) => [bot.id, bot])));
  const placed = new Set(Object.values(order).flat());
  return sections.map((section) => {
    const ids = order[sectionKey(section)];
    const kept = section.bots.filter((bot) => !placed.has(bot.id));
    const moved = (ids ?? []).flatMap((id) => byId.get(id) ?? []);
    return { ...section, bots: [...moved, ...kept] };
  });
}
