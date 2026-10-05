import { RoutineItem } from '@oppenheimer/design-system-web';
import { CalendarDays, CircleCheck } from '@oppenheimer/design-system-web/icons';
import { useTasks } from '@oppenheimer/frontend-consumer/react';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The head of Plan's sidebar (`18-plan-product.md` §1): Tasks, with the open
 * count, and Calendar. The board and the calendar each put their own list
 * under it.
 */
export function PlanNav() {
  const { t } = useTranslation();
  const { data: open } = useTasks({ select: (rows) => rows.filter((row) => !row.isDone).length });
  const onCalendar = Boolean(useMatchRoute()({ to: '/plan/calendar', fuzzy: true }));

  return (
    <nav aria-label={t('tasks.nav.label')} className="flex flex-col gap-0.5 px-3 pb-3">
      <RoutineItem
        name={t('tasks.nav.tasks')}
        icon={<CircleCheck />}
        meta={open === undefined ? undefined : String(open)}
        active={!onCalendar}
        render={<Link to="/plan" />}
      />
      <RoutineItem
        name={t('tasks.nav.calendar')}
        icon={<CalendarDays />}
        active={onCalendar}
        render={<Link to="/plan/calendar" />}
      />
    </nav>
  );
}
