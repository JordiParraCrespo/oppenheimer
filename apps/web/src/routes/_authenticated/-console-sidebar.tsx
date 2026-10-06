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
/**
 * Plan's two lists load as one: whichever the reader lands on fetches the
 * other, so the move between the board and the calendar has nothing left to
 * wait for.
 */
const planSidebars = () =>
  Promise.all([
    import('@/features/tasks/sections/tasks-sidebar'),
    import('@/features/calendar/sections/calendar-sidebar'),
  ]);
const TasksSidebar = lazy(() =>
  planSidebars().then(([tasks]) => ({ default: tasks.TasksSidebar })),
);
const CalendarSidebar = lazy(() =>
  planSidebars().then(([, calendar]) => ({ default: calendar.CalendarSidebar })),
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
          {/* A boundary per list: a swap that still suspends draws nothing under
              the nav, never the previous list, whose route is no longer matched. */}
          <Suspense key={list} fallback={null}>
            {list === 'tasks' ? <TasksSidebar /> : <CalendarSidebar />}
          </Suspense>
        </div>
      )}
    </Suspense>
  );
}
