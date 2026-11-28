import { lazy, Suspense } from 'react';
import { SearchableSectionBotsSkeleton } from '@/features/bots/sections/searchable-section-bots-skeleton';
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
/** Sessions' Bots heading, which searches its rows. */
const SearchableSectionBots = lazy(() =>
  import('@/features/bots/sections/searchable-section-bots').then((module) => ({
    default: module.SearchableSectionBots,
  })),
);

/**
 * The sidebar body beside the rail, for the list the address is under. Route
 * composition, beside the layout that mounts it (the `-` keeps it out of the
 * route tree): the Inbox has none (its route says so); Plan's is the tasks
 * feature's head (Tasks, TODO, Milestones, Calendar, Projects),
 * with the calendar's layers and accounts under it on the calendar; the
 * board and Milestones filter by project in the page. Every section but
 * Employees and the Inbox carries the bots placed in it: the bots feature
 * draws them, and each sidebar takes them as its `bots` slot and places
 * them where the design does. On sessions, the first page most visits
 * open, the bots' code arriving after the shell's holds its place
 * (`SearchableSectionBotsSkeleton`) so the list under it does not drop when it lands.
 * Two features that never import each other.
 */
export function ConsoleSidebar({ list }: { list: ConsoleList }) {
  if (list === 'sessions') {
    return (
      <SessionsSidebar
        bots={
          <Suspense fallback={<SearchableSectionBotsSkeleton section="sessions" />}>
            <SearchableSectionBots section="sessions" />
          </Suspense>
        }
      />
    );
  }
  return (
    <Suspense fallback={null}>
      {list === 'inbox' ? null : list === 'bots' ? (
        <BotsSidebar />
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
