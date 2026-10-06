import { lazy, Suspense } from 'react';
import { SessionsSidebar } from '@/features/sessions/sections/sessions-sidebar';
import type { ConsoleList } from '@/lib/console';

/**
 * The sidebars beyond sessions load with their pages, not with the shell:
 * most visits are to sessions, and the automations trigger catalog or Plan's
 * board have no business on their first load.
 */
const AutomationsSidebar = lazy(() =>
  import('@/features/automations/sections/automations-sidebar').then((module) => ({
    default: module.AutomationsSidebar,
  })),
);
const PullRequestsSidebar = lazy(() =>
  import('@/features/pull-requests/sections/pull-requests-sidebar').then((module) => ({
    default: module.PullRequestsSidebar,
  })),
);
const PlanNav = lazy(() =>
  import('@/features/tasks/sections/plan-nav').then((module) => ({ default: module.PlanNav })),
);
const TasksSidebar = lazy(() =>
  import('@/features/tasks/sections/tasks-sidebar').then((module) => ({
    default: module.TasksSidebar,
  })),
);
const CalendarSidebar = lazy(() =>
  import('@/features/calendar/sections/calendar-sidebar').then((module) => ({
    default: module.CalendarSidebar,
  })),
);

/**
 * The sidebar body beside the rail, for the list the address is under. Route
 * composition, beside the layout that mounts it (the `-` keeps it out of the
 * route tree): Plan's sidebar is the tasks feature's head over either the
 * board's projects or the calendar's layers, two features that never import
 * each other.
 */
export function ConsoleSidebar({ list }: { list: ConsoleList }) {
  if (list === 'sessions') return <SessionsSidebar />;
  return (
    <Suspense fallback={null}>
      {list === 'automations' ? (
        <AutomationsSidebar />
      ) : list === 'pulls' ? (
        <PullRequestsSidebar />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <PlanNav />
          {list === 'tasks' ? <TasksSidebar /> : <CalendarSidebar />}
        </div>
      )}
    </Suspense>
  );
}
