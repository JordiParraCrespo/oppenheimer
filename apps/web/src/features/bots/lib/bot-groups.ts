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
  /** How many of its bots are hidden and so not among `bots`. */
  hiddenCount: number;
}

/**
 * The sidebar's sections for a settled search: the groups in their order,
 * each with its bots by position, then Ungrouped. While a search narrows the
 * list a section with no match is left out; without one, every group stays
 * (an empty group is still somewhere to move a bot), and Ungrouped is drawn
 * only when it holds a bot, or with `keepUngrouped` (a drag held, for which
 * it is somewhere to drop one). A bot's group the groups read does not have
 * yet (a refetch in flight) counts as Ungrouped rather than vanishing. A bot
 * in `hidden` is left out, unless a search names it: a search is how a
 * hidden bot is found again.
 */
export function botSections(
  bots: readonly BotEntity[],
  groups: readonly BotGroupEntity[],
  query: string,
  {
    keepUngrouped = false,
    hidden = [],
  }: { keepUngrouped?: boolean; hidden?: readonly string[] } = {},
): BotSection[] {
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

  const sections: BotSection[] = [...groups]
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

/** The groups' ids in the order the sections draw them; Ungrouped is not one. */
export function groupOrder(sections: readonly BotSection[]): string[] {
  return sections.flatMap((section) => (section.id === null ? [] : [section.id]));
}

/**
 * The sections with their bots in `order` (a drag held, or a drop whose
 * write is in flight): a bot is drawn in the section and place `order` puts
 * it. `order` is drawn from these same sections, so it names every bot; the
 * exceptions are the list changing under a pending write, where a bot made
 * since is drawn after the ones `order` places, in its own section, and an
 * id that is no longer a bot is skipped.
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

/**
 * The sections with the groups in `groups`' order (a group drag held, or its
 * write in flight), Ungrouped last as always. A group `groups` does not name
 * (made since) is drawn after the ones it does, in the order it had.
 */
export function inGroupOrder(
  sections: readonly BotSection[],
  groups: readonly string[],
): BotSection[] {
  const rank = (section: BotSection) => {
    const at = section.id === null ? -1 : groups.indexOf(section.id);
    return at === -1 ? groups.length : at;
  };
  const grouped = sections.filter((section) => section.group !== null);
  const ungrouped = sections.filter((section) => section.group === null);
  return [...grouped.sort((a, b) => rank(a) - rank(b)), ...ungrouped];
}

/**
 * The position a dropped bot takes in its section's full order, hidden bots
 * included, when the reader only saw `drawn` (the drawn ids, the bot in its
 * new place). It goes right before the first bot drawn after it, so a hidden
 * bot just above that one keeps its place too; dropped after every drawn
 * bot, it goes last. `full` is the section's ids by position before the drop.
 */
export function positionAmong(
  full: readonly string[],
  drawn: readonly string[],
  id: string,
): number {
  const others = full.filter((other) => other !== id);
  const after = drawn.slice(drawn.indexOf(id) + 1).find((other) => others.includes(other));
  return after === undefined ? others.length : others.indexOf(after);
}

/** What a group with no bot drawn says: that its bots are hidden, or that it has none. */
export function emptyGroupLine(section: BotSection) {
  return section.hiddenCount > 0
    ? ({ key: 'bots.sidebar.allHidden', count: section.hiddenCount } as const)
    : ({ key: 'bots.sidebar.emptyGroup' } as const);
}
