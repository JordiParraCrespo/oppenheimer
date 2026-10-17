import { MilestoneGlyph, RoutineItem } from '@oppenheimer/design-system-web';
import { CalendarDays, CircleCheck } from '@oppenheimer/design-system-web/icons';
import { useMilestones, useTasks } from '@oppenheimer/frontend-consumer/react';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useTodayEventCount } from '../hooks/use-today-event-count';

/**
 * The head of Plan's sidebar (the 2026-10-13 `Tasks` frame): Tasks with the
 * open count, Milestones with how many there are, and Calendar with today's
 * events. The calendar puts its layers and accounts under it.
 */
export function PlanNav() {
  const { t } = useTranslation();
  const { data: open } = useTasks({ select: (rows) => rows.filter((row) => !row.isDone).length });
  const { data: milestones } = useMilestones({ select: (rows) => rows.length });
  const today = useTodayEventCount();
  const matchRoute = useMatchRoute();
  const onCalendar = Boolean(matchRoute({ to: '/plan/calendar', fuzzy: true }));
  const onMilestones = Boolean(matchRoute({ to: '/plan/milestones', fuzzy: true }));

  return (
    <nav aria-label={t('tasks.nav.label')} className="flex flex-col gap-0.5 px-3 pb-3">
      <RoutineItem
        name={t('tasks.nav.tasks')}
        icon={<CircleCheck />}
        meta={open === undefined ? undefined : String(open)}
        active={!onCalendar && !onMilestones}
        nativeButton={false}
        render={<Link to="/plan" />}
      />
      <RoutineItem
        name={t('tasks.nav.milestones')}
        icon={<MilestoneGlyph />}
        meta={milestones === undefined ? undefined : String(milestones)}
        active={onMilestones}
        nativeButton={false}
        render={<Link to="/plan/milestones" />}
      />
      <RoutineItem
        name={t('tasks.nav.calendar')}
        icon={<CalendarDays />}
        meta={today === undefined ? undefined : String(today)}
        active={onCalendar}
        nativeButton={false}
        render={<Link to="/plan/calendar" />}
      />
    </nav>
  );
}
