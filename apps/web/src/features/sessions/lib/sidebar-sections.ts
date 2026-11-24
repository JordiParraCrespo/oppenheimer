/** The sessions sidebar's sections, which the reader drags into an order. */
export type SidebarSection = 'bots' | 'sessions';

/** The order a reader who never moved a section sees: the bots above the sessions. */
const SIDEBAR_SECTIONS: readonly SidebarSection[] = ['bots', 'sessions'];

/**
 * The sections in the stored order. An id it no longer knows is dropped and
 * a section the stored order lacks goes where the default puts it, so an
 * empty or stale entry still draws every section once.
 */
export function sectionOrder(stored: readonly string[]): SidebarSection[] {
  const known = stored.filter(
    (id, index): id is SidebarSection =>
      (SIDEBAR_SECTIONS as readonly string[]).includes(id) && stored.indexOf(id) === index,
  );
  const missing = SIDEBAR_SECTIONS.filter((id) => !known.includes(id));
  return [...known, ...missing];
}

/** `order` with `moved` put where `target` stands; anything else returns `order` as it is. */
export function movedSection(
  order: readonly SidebarSection[],
  moved: string,
  target: string,
): SidebarSection[] {
  const from = order.indexOf(moved as SidebarSection);
  const to = order.indexOf(target as SidebarSection);
  if (from < 0 || to < 0 || from === to) return [...order];
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, order[from] as SidebarSection);
  return next;
}
