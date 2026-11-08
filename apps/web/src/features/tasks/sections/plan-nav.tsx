import {
  DragProvider,
  MilestoneGlyph,
  RoutineItem,
  SortableGroup,
  SortableRoutineItem,
} from '@oppenheimer/design-system-web';
import { Bell, CalendarDays, CircleCheck, Folder } from '@oppenheimer/design-system-web/icons';
import { useMilestones, useProjects, useTasks } from '@oppenheimer/frontend-consumer/react';
import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import { useDragLabels } from '@oppenheimer/frontend-web';
import { Link, useMatchRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PLAN_NAV_GROUP, usePlanNavOrder } from '../hooks/use-plan-nav-order';
import { useTodayEventCount } from '../hooks/use-today-event-count';
import { isPlanNavId, type PlanNavId } from '../lib/plan-nav-order';
import { PlanInboxItem } from './plan-inbox-item';

/**
 * Each view's name and glyph, for its row and the copy a drag lifts, and
 * where each view but the Inbox goes, with whether a route under it keeps it
 * lit. The Inbox is its own row (`PlanInboxItem`), which owns its minute tick.
 * A new view is a row here and its count below.
 */
const VIEWS = {
  inbox: { labelKey: 'tasks.nav.inbox', icon: <Bell /> },
  tasks: {
    labelKey: 'tasks.nav.tasks',
    icon: <CircleCheck />,
    route: { to: '/plan', fuzzy: false },
  },
  milestones: {
    labelKey: 'tasks.nav.milestones',
    icon: <MilestoneGlyph />,
    route: { to: '/plan/milestones', fuzzy: true },
  },
  calendar: {
    labelKey: 'tasks.nav.calendar',
    icon: <CalendarDays />,
    route: { to: '/plan/calendar', fuzzy: true },
  },
  projects: {
    labelKey: 'tasks.nav.projects',
    icon: <Folder />,
    route: { to: '/plan/projects', fuzzy: true },
  },
} as const satisfies Record<
  PlanNavId,
  { labelKey: string; icon: ReactNode; route?: { to: string; fuzzy: boolean } }
>;

/**
 * The head of Plan's sidebar (the `Tasks` frame): the Inbox with what needs
 * you (while the `inbox` flag is on), Tasks with the open count, Milestones
 * with how many there are, Calendar with today's events, and Projects with
 * how many the workspace holds. The calendar puts its layers and accounts
 * under it.
 *
 * The reader drags the views into their own order, as the rail's items do;
 * a press still opens the view, and the order is kept on this device
 * (`usePlanNavOrder`). The nav carries its own `DragProvider`.
 */
export function PlanNav() {
  const { t } = useTranslation();
  const { data: open } = useTasks({ select: (rows) => rows.filter((row) => !row.isDone).length });
  const { data: milestones } = useMilestones({ select: (rows) => rows.length });
  const today = useTodayEventCount();
  const { data: projects } = useProjects({ select: (rows) => rows.length });
  const inbox = useFeatureFlag('inbox');
  const matchRoute = useMatchRoute();
  const dragLabels = useDragLabels();
  const { order, handlers } = usePlanNavOrder((id) => id !== 'inbox' || inbox);
  const counts: Record<Exclude<PlanNavId, 'inbox'>, number | undefined> = {
    tasks: open,
    milestones,
    calendar: today,
    projects,
  };

  return (
    <nav aria-label={t('tasks.nav.label')} className="px-3 pb-3">
      <DragProvider
        {...handlers}
        labels={dragLabels}
        overlay={(active) =>
          isPlanNavId(active.id) ? (
            <RoutineItem name={t(VIEWS[active.id].labelKey)} icon={VIEWS[active.id].icon} active />
          ) : null
        }
      >
        <SortableGroup
          id={PLAN_NAV_GROUP}
          items={order}
          accepts={['routine-item']}
          className="flex flex-col gap-0.5"
        >
          {order.map((id) => {
            if (id === 'inbox') return <PlanInboxItem key={id} id={id} />;
            const { labelKey, icon, route } = VIEWS[id];
            const count = counts[id];
            return (
              <SortableRoutineItem
                key={id}
                id={id}
                name={t(labelKey)}
                icon={icon}
                meta={count === undefined ? undefined : String(count)}
                active={Boolean(matchRoute(route))}
                nativeButton={false}
                render={<Link to={route.to} />}
              />
            );
          })}
        </SortableGroup>
      </DragProvider>
    </nav>
  );
}
