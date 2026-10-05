import {
  Button,
  GoalCard,
  GoalEmpty,
  GoalGrid,
  IconButton,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Ellipsis, Plus } from '@oppenheimer/design-system-web/icons';
import { useGoals, useProjects } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatCalendarDay, useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GoalDialog } from '../dialogs/goal';
import { useBoardFilter } from '../hooks/use-board-filter';

const board = getRouteApi('/_authenticated/plan/');

/**
 * The goals over the board (`18-plan-product.md` §2): one card per goal of the
 * projects shown. A card filters the board to its goal and back; its "…"
 * edits it. The strip owns the goal dialog, since New goal and every Edit are
 * its own buttons.
 */
export function GoalsStrip() {
  const { t } = useTranslation();
  const locale = useLocale();
  const filter = useBoardFilter();
  const navigate = board.useNavigate();
  const goals = useGoals({
    select: (rows) =>
      rows.filter((goal) => !filter.projectId || goal.projectId === filter.projectId),
  });
  const { data: projectNames } = useProjects({
    select: (rows) => new Map(rows.map((row) => [row.id, row.isUnassigned ? '' : row.name])),
  });
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  return (
    <section aria-label={t('tasks.goals.label')} className="flex flex-col gap-3">
      <div className="flex items-center px-1">
        <span className="eyebrow flex-1">{t('tasks.goals.title')}</span>
        <Button variant="ghost" size="sm" onClick={() => setEditing('new')}>
          <Plus />
          {t('tasks.goals.new')}
        </Button>
      </div>
      {goals.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : goals.isError ? (
        <ErrorAlert error={goals.error} fallback={t('tasks.goals.loadFailed')} />
      ) : (
        <GoalGrid>
          {goals.data.map((goal) => (
            <GoalCard
              key={goal.id}
              name={goal.name}
              meta={
                <>
                  {projectNames?.get(goal.projectId) || t('tasks.sidebar.unassigned')}{' '}
                  <span className="text-fg-subtle">·</span>{' '}
                  <span className="figures">
                    {goal.targetDate
                      ? formatCalendarDay(goal.targetDate, locale, 'short')
                      : t('tasks.goals.noTarget')}
                  </span>
                </>
              }
              done={goal.doneCount}
              total={goal.totalCount}
              countLabel={t('tasks.goals.progress', {
                done: goal.doneCount,
                total: goal.totalCount,
              })}
              selected={filter.goalId === goal.id}
              onSelect={() =>
                navigate({
                  search: (previous) => ({
                    ...previous,
                    goal: previous.goal === goal.id ? undefined : goal.id,
                  }),
                  replace: true,
                })
              }
              action={
                <IconButton
                  size="sm"
                  aria-label={t('tasks.goals.edit', { name: goal.name })}
                  onClick={() => setEditing(goal.id)}
                >
                  <Ellipsis />
                </IconButton>
              }
            />
          ))}
          {goals.data.length === 0 ? (
            <GoalEmpty title={t('tasks.goals.emptyTitle')} onClick={() => setEditing('new')}>
              {t('tasks.goals.empty')}
            </GoalEmpty>
          ) : null}
        </GoalGrid>
      )}
      {editing ? (
        <GoalDialog
          goalId={editing === 'new' ? undefined : editing}
          projectId={filter.projectId || undefined}
          onClose={() => setEditing(null)}
          onDeleted={(id) => {
            setEditing(null);
            if (filter.goalId === id) {
              navigate({ search: (previous) => ({ ...previous, goal: undefined }), replace: true });
            }
          }}
        />
      ) : null}
    </section>
  );
}
