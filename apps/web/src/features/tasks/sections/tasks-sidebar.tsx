import { IconButton, RoutineItem, SidebarListHead, Skeleton } from '@oppenheimer/design-system-web';
import { Folder, Inbox, Layers, Plus } from '@oppenheimer/design-system-web/icons';
import { useProjects, useTasks } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { useScopeProject } from '../hooks/use-scope-project';
import { UNASSIGNED_SLUG } from '../lib/plan-scope';

/** The Plan views a project narrows: the sidebar's links keep the reader on the one they are on. */
type ScopedView = '/plan' | '/plan/milestones' | '/plan/stats';

/**
 * The board's sidebar list (`18-plan-product.md` §1): All projects, each
 * project with its open count, then Unassigned; "+" is the console's New
 * project. Picking one narrows the view the reader is on (the board, Milestones
 * or Stats) to it.
 */
export function TasksSidebar() {
  const { t } = useTranslation();
  // From the location, not one route's match: the shell mounts this sidebar
  // over three views and outlives each of them.
  const { slug: project } = useScopeProject();
  const view = useRouterState({
    select: (state): ScopedView =>
      state.location.pathname.startsWith('/plan/milestones')
        ? '/plan/milestones'
        : state.location.pathname.startsWith('/plan/stats')
          ? '/plan/stats'
          : '/plan',
  });
  const projects = useProjects();
  const { data: open } = useTasks({
    select: (rows) => {
      const counts = new Map<string, number>();
      for (const row of rows) {
        if (!row.isDone) counts.set(row.projectId, (counts.get(row.projectId) ?? 0) + 1);
      }
      return counts;
    },
  });
  const dialogs = useConsoleDialog();
  const total = open ? [...open.values()].reduce((sum, count) => sum + count, 0) : undefined;
  const named = (projects.data ?? []).filter((row) => !row.isUnassigned);
  const unassigned = projects.data?.find((row) => row.isUnassigned);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SidebarListHead label={t('tasks.sidebar.projects')} count={named.length || undefined}>
        <IconButton
          type="button"
          size="sm"
          aria-label={t('tasks.sidebar.newProject')}
          onClick={() => dialogs.open({ kind: 'project' })}
        >
          <Plus />
        </IconButton>
      </SidebarListHead>
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-5">
        <RoutineItem
          name={t('tasks.sidebar.all')}
          icon={<Layers />}
          meta={total === undefined ? undefined : String(total)}
          active={!project}
          nativeButton={false}
          render={<Link to={view} />}
        />
        {projects.isPending ? (
          <Skeleton className="h-7.5 w-full" />
        ) : projects.isError ? (
          <ErrorAlert
            error={projects.error}
            fallback={t('tasks.sidebar.loadFailed')}
            className="mt-2"
          />
        ) : (
          <>
            {named.map((row) => (
              <RoutineItem
                key={row.id}
                name={row.name}
                icon={<Folder />}
                meta={String(open?.get(row.id) ?? 0)}
                active={project === row.slug}
                nativeButton={false}
                render={<Link to={view} search={{ project: row.slug }} />}
              />
            ))}
            {unassigned ? (
              <RoutineItem
                name={t('tasks.sidebar.unassigned')}
                icon={<Inbox />}
                meta={String(open?.get(unassigned.id) ?? 0)}
                active={project === UNASSIGNED_SLUG}
                nativeButton={false}
                render={<Link to={view} search={{ project: UNASSIGNED_SLUG }} />}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
