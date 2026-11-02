import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { type InboxTypeFilter, NO_PROJECT } from './inbox-search';
import { type InboxVisit, visitOrder } from './inbox-visit';

export interface InboxFilter {
  type: InboxTypeFilter;
  /** A project's id, `none` (No project), or null for every project. */
  project: string | null;
}

/**
 * The Type facet each kind is counted under. A session's notice counts with
 * its sessions: the facet has no option of its own for it.
 */
const TYPE_OF: Record<InboxItem['kind'], Exclude<InboxTypeFilter, 'all'>> = {
  session: 'session',
  notice: 'session',
  approval: 'approval',
  pull: 'pull',
  run: 'run',
};

function matchesType(item: InboxItem, type: InboxTypeFilter): boolean {
  return type === 'all' || TYPE_OF[item.kind] === type;
}

/** An item two projects hold matches either; one no project holds matches `none`. */
function matchesProject(item: InboxItem, project: string | null): boolean {
  if (project === null) return true;
  if (project === NO_PROJECT) return item.projectIds.length === 0;
  return item.projectIds.includes(project);
}

function matchesFilter(item: InboxItem, filter: InboxFilter): boolean {
  return matchesType(item, filter.type) && matchesProject(item, filter.project);
}

/**
 * The counts beside each facet's options, as the frame draws them: a type's
 * count under the project picked, a project's under the type picked.
 */
export function facetCounts(items: readonly InboxItem[], filter: InboxFilter) {
  const types = Object.fromEntries(
    (['all', 'pull', 'approval', 'session', 'run'] as const).map((type) => [
      type,
      items.filter((item) => matchesType(item, type) && matchesProject(item, filter.project))
        .length,
    ]),
  ) as Record<InboxTypeFilter, number>;
  const ofType = items.filter((item) => matchesType(item, filter.type));
  const projects = new Map<string, number>();
  for (const item of ofType) {
    for (const id of item.projectIds.length ? item.projectIds : [NO_PROJECT]) {
      projects.set(id, (projects.get(id) ?? 0) + 1);
    }
  }
  return { types, projects, all: ofType.length };
}

/**
 * What the list shows, and the reading pane takes its item from: the open
 * items in this visit's order under the filter and the search (`found`), then
 * — with Show done — those marked done on this visit.
 */
export function listedItems(
  view: { open: readonly InboxItem[]; done: readonly InboxItem[] },
  visit: InboxVisit,
  filter: InboxFilter,
  showDone: boolean,
  found: (item: InboxItem) => boolean = () => true,
): { open: InboxItem[]; done: InboxItem[] } {
  const doneThisVisit = new Set(visit.done);
  const shown = (item: InboxItem) => matchesFilter(item, filter) && found(item);
  return {
    open: visitOrder(view.open, visit).filter(shown),
    done: showDone ? view.done.filter((item) => doneThisVisit.has(item.key) && shown(item)) : [],
  };
}
