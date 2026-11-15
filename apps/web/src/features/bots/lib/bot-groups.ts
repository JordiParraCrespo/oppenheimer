import {
  type BotEntity,
  type BotGroupEntity,
  type BotGroupSection,
  botGroupSections,
} from '@oppenheimer/frontend-consumer';

/**
 * The bot the sidebar draws first: the top pinned one (`pins`, in pin order),
 * else in its groups' order then Ungrouped; undefined with none.
 */
export function firstBot(
  bots: readonly BotEntity[],
  groups: readonly BotGroupEntity[],
  pins: readonly string[],
): BotEntity | undefined {
  const pinned = pins.flatMap((id) => bots.find((bot) => bot.id === id) ?? [])[0];
  return pinned ?? botGroupSections(bots, groups, '').flatMap((section) => section.bots)[0];
}

/** The key a section is dragged and folded by; Ungrouped has no id of its own. */
const UNGROUPED = 'ungrouped';

export function sectionKey(section: BotGroupSection): string {
  return section.id ?? UNGROUPED;
}

/** The group a section key names for the API: `null` for Ungrouped. */
export function groupIdOf(key: string): string | null {
  return key === UNGROUPED ? null : key;
}

/** Each section's bot ids, by its key: the value the drag layer moves. */
export function sectionOrder(sections: readonly BotGroupSection[]): Record<string, string[]> {
  return Object.fromEntries(
    sections.map((section) => [sectionKey(section), section.bots.map((bot) => bot.id)]),
  );
}

/** The groups' ids in the order the sections draw them; Ungrouped is not one. */
export function groupOrder(sections: readonly BotGroupSection[]): string[] {
  return sections.flatMap((section) => (section.id === null ? [] : [section.id]));
}

/**
 * The sections with their bots in `order` (a drag held, or a drop whose
 * write is in flight): a bot is drawn in the section and place `order` puts
 * it. `order` is drawn from these same sections, so it names every bot; the
 * exceptions are the list changing under a pending write, where a bot made
 * since is drawn after the ones `order` places, in its own section, and an
 * id that is no longer a bot is skipped. `also` are bots `order` may name
 * that no section draws (the pinned ones, dragged out of Pinned).
 */
export function inOrder(
  sections: readonly BotGroupSection[],
  order: Readonly<Record<string, readonly string[]>>,
  also: readonly BotEntity[] = [],
): BotGroupSection[] {
  const byId = new Map(
    [...also, ...sections.flatMap((section) => section.bots)].map((bot) => [bot.id, bot]),
  );
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
  sections: readonly BotGroupSection[],
  groups: readonly string[],
): BotGroupSection[] {
  const rank = (section: BotGroupSection) => {
    const at = section.id === null ? -1 : groups.indexOf(section.id);
    return at === -1 ? groups.length : at;
  };
  const grouped = sections.filter((section) => section.group !== null);
  const ungrouped = sections.filter((section) => section.group === null);
  return [...grouped.sort((a, b) => rank(a) - rank(b)), ...ungrouped];
}

/**
 * What a group with no bot drawn says: that its bots are pinned (drawn
 * under Pinned, `pinnedHere` of them), that they are hidden, or that it has
 * none.
 */
export function emptyGroupLine(section: BotGroupSection, pinnedHere: number) {
  if (pinnedHere > 0) return { key: 'bots.sidebar.allPinned' } as const;
  return section.hiddenCount > 0
    ? ({ key: 'bots.sidebar.allHidden', count: section.hiddenCount } as const)
    : ({ key: 'bots.sidebar.emptyGroup' } as const);
}
