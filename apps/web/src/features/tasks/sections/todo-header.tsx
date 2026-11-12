import {
  Button,
  IconButton,
  PageHeader,
  PageHeaderMeta,
  PageHeaderRow,
  PageHeaderSep,
  PageHeaderStat,
} from '@oppenheimer/design-system-web';
import { ChevronLeft, ChevronRight } from '@oppenheimer/design-system-web/icons';
import { useSessions, useTasks } from '@oppenheimer/frontend-consumer/react';
import { addDays, dateFormatter, isoWeek, useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useScopeProject } from '../hooks/use-scope-project';
import { useTodoDay } from '../hooks/use-todo-day';
import { todoCounts, todoEntries, withAgentsOf } from '../lib/todo';

const todo = getRouteApi('/_authenticated/plan/todo');

/** "domingo, 8 de noviembre" reads "Domingo, 8 de noviembre" as a title. */
const capitalized = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/**
 * To do's header (the 2026-11-08 `Tasks` frame): Today · Week 45 (or the
 * week alone on another day), the day as the title, how many of its tasks
 * are left (what is with agents is not) and done, then Today and the day
 * before and after.
 */
export function TodoHeader() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { day, today } = useTodoDay();
  const { overdue } = todo.useSearch();
  const { projectIds } = useScopeProject();
  const navigate = todo.useNavigate();
  const { data: sessions } = useSessions({
    select: (rows) => new Map(rows.map((row) => [row.id, row])),
  });
  // No count until the sessions are in: what is with agents is not left, so
  // a count before they land would drop once they do.
  const { data: counts } = useTasks({
    select: (rows) =>
      sessions
        ? todoCounts(
            todoEntries(rows, day, { today, overdue: overdue !== 'off', projectIds }),
            withAgentsOf(rows, sessions),
          )
        : undefined,
  });
  const go = (next: string) =>
    navigate({
      search: (previous) => ({ ...previous, date: next === today ? undefined : next }),
      replace: true,
    });
  const title = capitalized(
    dateFormatter(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
      timeZone: 'UTC',
    }).format(new Date(`${day}T00:00:00Z`)),
  );

  return (
    <PageHeader>
      <span className="eyebrow">
        {day === today
          ? t('tasks.todo.todayWeek', { week: isoWeek(day) })
          : t('tasks.todo.weekNumber', { week: isoWeek(day) })}
      </span>
      <PageHeaderRow
        size="display"
        title={title}
        meta={
          counts ? (
            <PageHeaderMeta indent={false}>
              <PageHeaderStat value={counts.left}>{t('tasks.todo.left')}</PageHeaderStat>
              <PageHeaderSep />
              <PageHeaderStat value={counts.done}>{t('tasks.todo.done')}</PageHeaderStat>
            </PageHeaderMeta>
          ) : null
        }
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => go(today)}>
              {t('tasks.todo.today')}
            </Button>
            <IconButton
              size="sm"
              aria-label={t('tasks.todo.previous')}
              onClick={() => go(addDays(day, -1))}
            >
              <ChevronLeft />
            </IconButton>
            <IconButton
              size="sm"
              aria-label={t('tasks.todo.next')}
              onClick={() => go(addDays(day, 1))}
            >
              <ChevronRight />
            </IconButton>
          </div>
        }
      />
    </PageHeader>
  );
}
