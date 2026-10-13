import { MilestoneGlyph, RoutineItem } from '@oppenheimer/design-system-web';
import { CalendarDays, ChartLine, CircleCheck } from '@oppenheimer/design-system-web/icons';
import { useMilestones, useTasks } from '@oppenheimer/frontend-consumer/react';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The head of Plan's sidebar (`18-plan-product.md` §1, and the 2026-10-13
 * frame in `23-plan-milestones-stats-accounts.md`): Tasks, with the open
 * count, Milestones, Calendar and Stats. Each view puts its own list under it.
 */
export function PlanNav() {
  const { t } = useTranslation();
  const { data: open } = useTasks({ select: (rows) => rows.filter((row) => !row.isDone).length });
  const matchRoute = useMatchRoute();
  const onCalendar = Boolean(matchRoute({ to: '/plan/calendar', fuzzy: true }));
  const onMilestones = Boolean(matchRoute({ to: '/plan/milestones', fuzzy: true }));
  const onStats = Boolean(matchRoute({ to: '/plan/stats', fuzzy: true }));
  const { data: milestones } = useMilestones({ select: (rows) => rows.length });

  return (
    <nav aria-label={t('tasks.nav.label')} className="flex flex-col gap-0.5 px-3 pb-3">
      <RoutineItem
        name={t('tasks.nav.tasks')}
        icon={<CircleCheck />}
        meta={open === undefined ? undefined : String(open)}
        active={!onCalendar && !onMilestones && !onStats}
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
        active={onCalendar}
        nativeButton={false}
        render={<Link to="/plan/calendar" />}
      />
      <RoutineItem
        name={t('tasks.nav.stats')}
        icon={<ChartLine />}
        active={onStats}
        nativeButton={false}
        render={<Link to="/plan/stats" />}
      />
    </nav>
  );
}
