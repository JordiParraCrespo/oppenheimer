import {
  type DragItem,
  type DragMove,
  type SortableGroups,
  sortableProjectId,
  useSortableGroups,
} from '@oppenheimer/design-system-web';
import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';
import { useMoveSession } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useState } from 'react';
import { groupByProject } from '../lib/session-groups';
import {
  mergeOrder,
  orderProjects,
  orderSessions,
  rememberSidebarOrder,
  type SidebarOrder,
  storedSidebarOrder,
} from '../lib/sidebar-order';
import type { SessionPins } from './use-session-pins';

/** The `SortableGroup` the projects sit in; a project's sessions sit in one named by its id. */
export const PROJECTS_GROUP = 'projects';

/** The `SortableGroup` of the sessions pinned above the projects. */
export const PINNED_GROUP = 'pinned';

/**
 * The sidebar's groups in the reader's order, and the drag that changes it.
 * Projects and the sessions inside them are dragged into an order kept on
 * this device (`sidebar-order.ts`). A session dropped in another project is
 * moved there, the same write as Move to project…: it is drawn where it was
 * dropped while the move is in flight, its place is kept once the move
 * lands, and a move that fails leaves it, and the stored order, as they were.
 *
 * Everything is drawn through one pipeline: an order of projects, an order
 * of sessions, and the project each session is drawn in. Between drags they
 * are the stored order and the move in flight; while a drag is held, the
 * groups the drag layer last published.
 *
 * `sessions` arrive narrowed and in the sort's order. The reader's own order
 * applies under the `custom` sort; a session dropped under another sort keeps
 * the order the reader was looking at, and `onReorder` asks for `custom` so
 * it stays. Spread `handlers` on the sidebar's `DragProvider`.
 *
 * A filter or the search can narrow what is drawn, and the rows still drag:
 * a drop places the rows it saw, and every row it did not keeps its place
 * among them as `every` draws it, the whole list in the sort's order, so
 * clearing the filter shows the hidden rows where they were.
 *
 * `projects` are all of them; `listed` says which are drawn. A project the
 * reader hid is not, but a drop of the drawn ones keeps its place, placed
 * by a drag or not, so showing it again puts it back where it was.
 *
 * Pinned is one more group (`PINNED_GROUP`): a session dropped on it is
 * pinned where it lands, a pinned one dragged up or down it is re-pinned in
 * that order, and one dragged out into a project is unpinned there, moved
 * too when the project is another. `pinned` are the pinned sessions drawn,
 * in pin order, and `sessions` the rest; `carrying` is whether a session is
 * being dragged, for Pinned to show where a pin can go before there is one.
 */
export function useSidebarOrder({
  projects,
  listed = () => true,
  sessions,
  every = sessions,
  pinned,
  pins,
  custom,
  onReorder,
  onWrite,
}: {
  projects: readonly ProjectEntity[];
  listed?: (projectId: string) => boolean;
  sessions: readonly SessionEntity[];
  /** Every session the list draws with no filter or search, in the sort's order. */
  every?: readonly SessionEntity[];
  pinned: readonly SessionEntity[];
  pins: Pick<SessionPins, 'setPinned' | 'placePins'>;
  custom: boolean;
  onReorder: () => void;
  onWrite: (error: Error | null) => void;
}) {
  const [stored, setStored] = useState<SidebarOrder>(storedSidebarOrder);
  const [live, setLive] = useState<SortableGroups | null>(null);
  // A cross-project drop's session order, drawn until its move settles.
  const [proposed, setProposed] = useState<readonly string[] | null>(null);
  const [carrying, setCarrying] = useState(false);
  const move = useMoveSession();

  // localStorage: the order outlives the page on this device.
  useEffect(() => rememberSidebarOrder(stored), [stored]);

  const byItemId = new Map(projects.map((project) => [sortableProjectId(project.id), project.id]));
  const projectIdsOf = (groups: SortableGroups) =>
    (groups[PROJECTS_GROUP] ?? []).flatMap((itemId) => byItemId.get(itemId) ?? []);

  let projectOrder = stored.projects;
  let sessionOrder = proposed ?? stored.sessions;
  const drawnIn = new Map<string, string>();
  if (move.isPending && move.variables) drawnIn.set(move.variables.id, move.variables.projectId);
  if (live) {
    projectOrder = projectIdsOf(live);
    sessionOrder = projectOrder.flatMap((projectId) => live[projectId] ?? []);
    for (const projectId of projectOrder) {
      for (const id of live[projectId] ?? []) drawnIn.set(id, projectId);
    }
  }
  // While a drag is held, Pinned holds what the drag layer says it does.
  const everyone = new Map([...pinned, ...sessions].map((session) => [session.id, session]));
  const pinnedRows = live
    ? (live[PINNED_GROUP] ?? []).flatMap((id) => everyone.get(id) ?? [])
    : [...pinned];
  const pinnedIds = new Set(pinnedRows.map((session) => session.id));
  const unpinned = [...everyone.values()].filter((session) => !pinnedIds.has(session.id));
  const drawn = unpinned.map((session) => {
    const projectId = drawnIn.get(session.id);
    return projectId && projectId !== session.projectId ? session.inProject(projectId) : session;
  });
  const groups = groupByProject(
    orderProjects(
      projects.filter((project) => listed(project.id)),
      projectOrder,
    ),
    custom || live ? orderSessions(drawn, sessionOrder) : drawn,
  );

  const value: SortableGroups = {
    [PINNED_GROUP]: pinnedRows.map((session) => session.id),
    [PROJECTS_GROUP]: groups.flatMap(({ project }) =>
      project ? [sortableProjectId(project.id)] : [],
    ),
  };
  for (const { project, sessions: members } of groups) {
    if (project) value[project.id] = members.map((session) => session.id);
  }

  // A drop's order with every row it did not see (filtered out, pinned, or in a
  // project not drawn) kept in its place among its own project's rows, in the
  // whole list's order as the reader last saw it.
  const placeUnseen = (
    next: SortableGroups,
    projectIds: readonly string[],
    stored: readonly string[],
  ) => {
    const projectOf = new Map(every.map((session) => [session.id, session.projectId]));
    const cameFrom = new Map(projectOf);
    for (const projectId of projectIds) {
      for (const id of next[projectId] ?? []) projectOf.set(id, projectId);
    }
    const whole = (custom ? orderSessions(every, stored) : every).map((session) => session.id);
    const projectOrder = [
      ...new Set([...projectIds, ...whole.flatMap((id) => projectOf.get(id) ?? [])]),
    ];
    const placed = projectOrder.flatMap((projectId) =>
      mergeOrder(
        next[projectId] ?? [],
        // A row dropped in from another project anchors nothing at its old place.
        whole.filter(
          (id) => projectOf.get(id) === projectId && (cameFrom.get(id) ?? projectId) === projectId,
        ),
      ),
    );
    return mergeOrder(placed, stored);
  };

  const handlers = useSortableGroups(
    value,
    (next, { settled }) => setLive(settled ? null : next),
    ({ id, from, to }, next) => {
      const projectIds = projectIdsOf(next);
      if (to === PINNED_GROUP) {
        pins.placePins(next[PINNED_GROUP] ?? []);
        return;
      }
      if (from === PROJECTS_GROUP) {
        setStored((current) => ({
          ...current,
          projects: mergeOrder(
            projectIds,
            orderProjects(projects, current.projects).map(({ id }) => id),
          ),
        }));
        return;
      }
      const order = projectIds.flatMap((projectId) => next[projectId] ?? []);
      const placed = (stored: readonly string[]) => placeUnseen(next, projectIds, stored);
      if (!custom) onReorder();
      if (from === PINNED_GROUP) pins.setPinned(id, false);
      const fromProject = from === PINNED_GROUP ? everyone.get(id)?.projectId : from;
      if (fromProject === to) {
        setStored((current) => ({
          ...current,
          sessions: placed(current.sessions),
        }));
        return;
      }
      setProposed(order);
      move.mutate(
        { id, projectId: to },
        {
          onSuccess: () => {
            setStored((current) => ({
              ...current,
              sessions: placed(current.sessions),
            }));
            onWrite(null);
          },
          onError: onWrite,
          onSettled: () => setProposed(null),
        },
      );
    },
  );

  // A session's drag shows Pinned even when nothing is pinned yet.
  const carryingSession = (active: DragItem) => active.data.type === 'session';
  return {
    groups,
    pinned: pinnedRows,
    carrying,
    handlers: {
      ...handlers,
      onDragStart: (active: DragItem) => {
        setCarrying(carryingSession(active));
        handlers.onDragStart(active);
      },
      onDragEnd: (move: DragMove) => {
        setCarrying(false);
        handlers.onDragEnd(move);
      },
      onDragCancel: () => {
        setCarrying(false);
        handlers.onDragCancel();
      },
    },
  };
}
