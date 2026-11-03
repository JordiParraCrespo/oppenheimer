import {
  DragProvider,
  MilestoneGlyph,
  RoutineItem,
  SortableGroup,
  SortableRoutineItem,
} from '@oppenheimer/design-system-web';
import { Bell, CalendarDays, CircleCheck } from '@oppenheimer/design-system-web/icons';
import { useMilestones, useTasks } from '@oppenheimer/frontend-consumer/react';
import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import { useDragLabels } from '@oppenheimer/frontend-web';
import { Link, useMatchRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PLAN_NAV_GROUP, usePlanNavOrder } from '../hooks/use-plan-nav-order';
import { useTodayEventCount } from '../hooks/use-today-event-count';
import type { PlanNavId } from '../lib/plan-nav-order';
import { PlanInboxItem } from './plan-inbox-item';

/** Each view's name and glyph, for its row and the copy a drag lifts. */
const LOOK = {
  inbox: { labelKey: 'tasks.nav.inbox', icon: <Bell /> },
  tasks: { labelKey: 'tasks.nav.tasks', icon: <CircleCheck /> },
  milestones: { labelKey: 'tasks.nav.milestones', icon: <MilestoneGlyph /> },
  calendar: { labelKey: 'tasks.nav.calendar', icon: <CalendarDays /> },
} as const satisfies Record<PlanNavId, { labelKey: string; icon: ReactNode }>;

function isPlanNavId(id: string): id is PlanNavId {
  return id in LOOK;
}

/**
 * The head of Plan's sidebar (the `Tasks` frame): the Inbox with what needs
 * you (while the `inbox` flag is on), Tasks with the open count, Milestones
 * with how many there are, and Calendar with today's events. The calendar
 * puts its layers and accounts under it.
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
  const inbox = useFeatureFlag('inbox');
  const matchRoute = useMatchRoute();
  const dragLabels = useDragLabels();
  const { order, handlers } = usePlanNavOrder((id) => id !== 'inbox' || inbox);

  const row = (id: Exclude<PlanNavId, 'inbox'>) => {
    switch (id) {
      case 'tasks':
        return (
          <SortableRoutineItem
            key={id}
            id={id}
            name={t(LOOK.tasks.labelKey)}
            icon={LOOK.tasks.icon}
            meta={open === undefined ? undefined : String(open)}
            active={Boolean(matchRoute({ to: '/plan' }))}
            nativeButton={false}
            render={<Link to="/plan" />}
          />
        );
      case 'milestones':
        return (
          <SortableRoutineItem
            key={id}
            id={id}
            name={t(LOOK.milestones.labelKey)}
            icon={LOOK.milestones.icon}
            meta={milestones === undefined ? undefined : String(milestones)}
            active={Boolean(matchRoute({ to: '/plan/milestones', fuzzy: true }))}
            nativeButton={false}
            render={<Link to="/plan/milestones" />}
          />
        );
      case 'calendar':
        return (
          <SortableRoutineItem
            key={id}
            id={id}
            name={t(LOOK.calendar.labelKey)}
            icon={LOOK.calendar.icon}
            meta={today === undefined ? undefined : String(today)}
            active={Boolean(matchRoute({ to: '/plan/calendar', fuzzy: true }))}
            nativeButton={false}
            render={<Link to="/plan/calendar" />}
          />
        );
    }
  };

  return (
    <nav aria-label={t('tasks.nav.label')} className="px-3 pb-3">
      <DragProvider
        {...handlers}
        labels={dragLabels}
        overlay={(active) =>
          isPlanNavId(active.id) ? (
            <RoutineItem name={t(LOOK[active.id].labelKey)} icon={LOOK[active.id].icon} active />
          ) : null
        }
      >
        <SortableGroup
          id={PLAN_NAV_GROUP}
          items={order}
          accepts={['routine-item']}
          className="flex flex-col gap-0.5"
        >
          {order.map((id) => (id === 'inbox' ? <PlanInboxItem key={id} id={id} /> : row(id)))}
        </SortableGroup>
      </DragProvider>
    </nav>
  );
}
