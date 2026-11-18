import {
  type BotEntity,
  type BotGroupEntity,
  type BotGroupSection,
  botGroupSections,
} from '@oppenheimer/frontend-consumer';

/**
 * The bot the sidebar draws first: the top pinned one (`pins`, in pin order),
 * else in the sections' order, Ungrouped where `ungroupedBefore` puts it;
 * undefined with none.
 */
export function firstBot(
  bots: readonly BotEntity[],
  groups: readonly BotGroupEntity[],
  pins: readonly string[],
  ungroupedBefore?: string,
): BotEntity | undefined {
  const pinned = pins.flatMap((id) => bots.find((bot) => bot.id === id) ?? [])[0];
  return (
    pinned ??
    botGroupSections(bots, groups, '', { ungroupedBefore }).flatMap((section) => section.bots)[0]
  );
}

/** The key a section is dragged and folded by; Ungrouped has no id of its own. */
export const UNGROUPED = 'ungrouped';

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

/** The sections' keys in the order they are drawn, Ungrouped's among the groups'. */
export function groupOrder(sections: readonly BotGroupSection[]): string[] {
  return sections.map(sectionKey);
}

/**
 * Where a drop among the groups leaves Ungrouped, from the sections' keys
 * after it: above a group, last, or not drawn (the drop says nothing of its
 * place).
 */
export type UngroupedDrop = { kind: 'before'; id: string } | { kind: 'last' } | { kind: 'absent' };

export function ungroupedDropIn(keys: readonly string[]): UngroupedDrop {
  const at = keys.indexOf(UNGROUPED);
  if (at === -1) return { kind: 'absent' };
  const below = keys[at + 1];
  return below === undefined ? { kind: 'last' } : { kind: 'before', id: below };
}

/** A group's place among the groups alone, as the API's `position` counts it. */
export function groupPosition(keys: readonly string[], id: string): number {
  return keys.filter((key) => key !== UNGROUPED).indexOf(id);
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
 * The sections in the order of `keys` (a group drag held, or its write in
 * flight), Ungrouped's key among them. A section `keys` does not name (a
 * group made since, or Ungrouped drawn only now) keeps the place it had.
 */
export function inGroupOrder(
  sections: readonly BotGroupSection[],
  keys: readonly string[],
): BotGroupSection[] {
  // The named sections' slots, in the order they are drawn, take the named sections in `keys`' order.
  const isNamed = (section: BotGroupSection) => keys.includes(sectionKey(section));
  const ordered = sections
    .filter(isNamed)
    .sort((a, b) => keys.indexOf(sectionKey(a)) - keys.indexOf(sectionKey(b)));
  const slots = sections.flatMap((section, at) => (isNamed(section) ? [at] : []));
  const drawn = [...sections];
  slots.forEach((at, nth) => {
    drawn[at] = ordered[nth] as BotGroupSection;
  });
  return drawn;
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
