import {
  type SortableGroups,
  sortableProjectId,
  useSortableGroups,
} from '@oppenheimer/design-system-web';
import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';
import { useMoveSession } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useState } from 'react';
import { groupByProject } from '../lib/session-groups';
import {
  orderProjects,
  orderSessions,
  rememberSidebarOrder,
  type SidebarOrder,
  storedSidebarOrder,
} from '../lib/sidebar-order';

/** The `SortableGroup` the projects sit in; a project's sessions sit in one named by its id. */
export const PROJECTS_GROUP = 'projects';

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
 */
export function useSidebarOrder({
  projects,
  sessions,
  custom,
  onReorder,
  onWrite,
}: {
  projects: readonly ProjectEntity[];
  sessions: readonly SessionEntity[];
  custom: boolean;
  onReorder: () => void;
  onWrite: (error: Error | null) => void;
}) {
  const [stored, setStored] = useState<SidebarOrder>(storedSidebarOrder);
  const [live, setLive] = useState<SortableGroups | null>(null);
  // A cross-project drop's session order, drawn until its move settles.
  const [proposed, setProposed] = useState<readonly string[] | null>(null);
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
  const drawn = sessions.map((session) => {
    const projectId = drawnIn.get(session.id);
    return projectId && projectId !== session.projectId ? session.inProject(projectId) : session;
  });
  const groups = groupByProject(
    orderProjects(projects, projectOrder),
    custom || live ? orderSessions(drawn, sessionOrder) : drawn,
  );

  const value: SortableGroups = {
    [PROJECTS_GROUP]: groups.flatMap(({ project }) =>
      project ? [sortableProjectId(project.id)] : [],
    ),
  };
  for (const { project, sessions: members } of groups) {
    if (project) value[project.id] = members.map((session) => session.id);
  }

  const handlers = useSortableGroups(
    value,
    (next, { settled }) => setLive(settled ? null : next),
    ({ id, from, to }, next) => {
      const projectIds = projectIdsOf(next);
      if (from === PROJECTS_GROUP) {
        setStored((current) => ({ ...current, projects: projectIds }));
        return;
      }
      const order = projectIds.flatMap((projectId) => next[projectId] ?? []);
      if (!custom) onReorder();
      if (from === to) {
        setStored((current) => ({ ...current, sessions: order }));
        return;
      }
      setProposed(order);
      move.mutate(
        { id, projectId: to },
        {
          onSuccess: () => {
            setStored((current) => ({ ...current, sessions: order }));
            onWrite(null);
          },
          onError: onWrite,
          onSettled: () => setProposed(null),
        },
      );
    },
  );

  return { groups, handlers };
}
