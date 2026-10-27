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
const BotsSidebar = lazy(() =>
  import('@/features/bots/sections/bots-sidebar').then((module) => ({
    default: module.BotsSidebar,
  })),
);
const CloudAgentsSidebar = lazy(() =>
  import('@/features/cloud-agents/sections/cloud-agents-sidebar').then((module) => ({
    default: module.CloudAgentsSidebar,
  })),
);
const PullRequestsSidebar = lazy(() =>
  import('@/features/pull-requests/sections/pull-requests-sidebar').then((module) => ({
    default: module.PullRequestsSidebar,
  })),
);
const PlanSidebar = lazy(() =>
  import('@/features/tasks/sections/plan-sidebar').then((module) => ({
    default: module.PlanSidebar,
  })),
);
const CalendarSidebar = lazy(() =>
  import('@/features/calendar/sections/calendar-sidebar').then((module) => ({
    default: module.CalendarSidebar,
  })),
);
/** A section's Bots heading, lazy like the sidebars: it is the bots feature's, not the shell's. */
const SectionBots = lazy(() =>
  import('@/features/bots/sections/section-bots').then((module) => ({
    default: module.SectionBots,
  })),
);

/**
 * The sidebar body beside the rail, for the list the address is under. Route
 * composition, beside the layout that mounts it (the `-` keeps it out of the
 * route tree): Plan's sidebar is the tasks feature's head (Tasks, Milestones,
 * Calendar), with the calendar's layers and accounts under it on the
 * calendar; the board and Milestones filter by project in the page.
 * Every section but Employees carries the bots placed in it
 * (`product/versions/mvp/28-bots-in-sections.md`): the bots feature draws
 * them, and each sidebar takes them as its `bots` slot and places them where
 * the design does.
 * Two features that never import each other.
 */
export function ConsoleSidebar({ list }: { list: ConsoleList }) {
  if (list === 'sessions') {
    return (
      <SessionsSidebar
        bots={
          <Suspense fallback={null}>
            <SectionBots section="sessions" />
          </Suspense>
        }
      />
    );
  }
  return (
    <Suspense fallback={null}>
      {list === 'bots' ? (
        <BotsSidebar />
      ) : list === 'cloud' ? (
        <CloudAgentsSidebar />
      ) : list === 'automations' ? (
        <AutomationsSidebar bots={<SectionBots section="automations" />} />
      ) : list === 'pulls' ? (
        <PullRequestsSidebar bots={<SectionBots section="pulls" />} />
      ) : (
        <PlanSidebar bots={<SectionBots section="plan" />}>
          {list === 'calendar' ? (
            <Suspense fallback={null}>
              <CalendarSidebar />
            </Suspense>
          ) : null}
        </PlanSidebar>
      )}
    </Suspense>
  );
}
