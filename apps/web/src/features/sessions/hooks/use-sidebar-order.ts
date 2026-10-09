import { type SortableGroups, useSortableGroups } from '@oppenheimer/design-system-web';
import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';
import { useMoveSession } from '@oppenheimer/frontend-consumer/react';
import { useRef, useState } from 'react';
import { groupByProject, type ProjectGroup } from '../lib/session-groups';
import {
  orderProjects,
  orderSessions,
  PROJECTS_GROUP,
  projectIdOf,
  projectItemId,
  rememberSidebarOrder,
  type SidebarOrder,
  storedSidebarOrder,
} from '../lib/sidebar-order';

/** A session dropped in another project, drawn there until the list says it moved. */
type Moving = Record<string, { from: string; to: string }>;

/**
 * The sidebar's groups in the reader's order, and the drag that changes it.
 * Projects and the sessions inside them are dragged into an order kept on
 * this device (`sidebar-order.ts`); a session dropped in another project is
 * moved there, the same write as Move to project…, and stays drawn where it
 * was dropped until the list catches up (or goes back, if the move fails).
 *
 * `sessions` arrive narrowed and in the sort's order. The reader's own
 * order applies under the `custom` sort; a session dropped under another
 * sort keeps the order the reader was looking at, and `onReorder` asks for
 * `custom` so it stays. Spread `handlers` on the sidebar's `DragProvider`.
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
  const [moving, setMoving] = useState<Moving>({});
  // The value a drag last published, which the drop reads before a render.
  const latest = useRef<SortableGroups | null>(null);
  const move = useMoveSession({
    onSuccess: () => onWrite(null),
    onError: (error, { id }) => {
      setMoving((current) => without(current, [id]));
      onWrite(error);
    },
  });

  // A move the list now shows, or that no longer applies, is done with.
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const settled = Object.keys(moving).filter((id) => byId.get(id)?.projectId !== moving[id]?.from);
  if (settled.length > 0) setMoving((current) => without(current, settled));
  const projectOf = (session: SessionEntity) => {
    const pending = moving[session.id];
    return pending && pending.from === session.projectId ? pending.to : session.projectId;
  };

  const placed = groupByProject(
    orderProjects(projects, stored.projects),
    custom ? orderSessions(sessions, stored.sessions) : sessions,
    projectOf,
  );
  const groups = live ? arrange(placed, live) : placed;

  const value: SortableGroups = { [PROJECTS_GROUP]: [] };
  for (const group of groups) {
    if (!group.project) continue;
    value[PROJECTS_GROUP] = [...(value[PROJECTS_GROUP] ?? []), projectItemId(group.project.id)];
    value[group.project.id] = group.sessions.map((session) => session.id);
  }

  function remember(next: SidebarOrder) {
    setStored(next);
    rememberSidebarOrder(next);
  }

  const sortable = useSortableGroups(
    value,
    (next) => {
      latest.current = next;
      setLive(next);
    },
    ({ id, from, to }) => {
      const next = latest.current;
      if (!next) return;
      const order = (next[PROJECTS_GROUP] ?? []).map(projectIdOf);
      if (from === PROJECTS_GROUP) {
        remember({ ...stored, projects: order });
        return;
      }
      remember({ ...stored, sessions: order.flatMap((projectId) => next[projectId] ?? []) });
      if (!custom) onReorder();
      if (from !== to) {
        setMoving((current) => ({ ...current, [id]: { from, to } }));
        move.mutate({ id, projectId: to });
      }
    },
  );

  const settle = () => {
    latest.current = null;
    setLive(null);
  };

  return {
    groups,
    handlers: {
      ...sortable,
      onDragEnd: (...args: Parameters<typeof sortable.onDragEnd>) => {
        sortable.onDragEnd(...args);
        settle();
      },
      onDragCancel: () => {
        sortable.onDragCancel();
        settle();
      },
    },
  };
}

function without(moving: Moving, ids: readonly string[]): Moving {
  return Object.fromEntries(Object.entries(moving).filter(([id]) => !ids.includes(id)));
}

/** The groups as a drag has them right now: its projects' order, and each one's sessions. */
function arrange(groups: readonly ProjectGroup[], live: SortableGroups): ProjectGroup[] {
  const sessions = new Map(
    groups.flatMap((group) => group.sessions).map((session) => [session.id, session]),
  );
  const byProject = new Map(
    groups.flatMap((group) => (group.project ? [[group.project.id, group.project] as const] : [])),
  );
  const ordered = (live[PROJECTS_GROUP] ?? []).flatMap((itemId) => {
    const project = byProject.get(projectIdOf(itemId));
    if (!project) return [];
    const members = (live[project.id] ?? []).flatMap((id) => sessions.get(id) ?? []);
    return [{ project, sessions: members }];
  });
  return [...ordered, ...groups.filter((group) => !group.project)];
}
