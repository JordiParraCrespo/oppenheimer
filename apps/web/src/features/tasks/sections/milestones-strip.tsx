import {
  Button,
  IconButton,
  MilestoneCard,
  MilestoneEmpty,
  MilestoneGrid,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Ellipsis, Plus } from '@oppenheimer/design-system-web/icons';
import { useMilestones, useProjects } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatCalendarDay, useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MilestoneDialog } from '../dialogs/milestone';
import { useBoardFilter } from '../hooks/use-board-filter';

const board = getRouteApi('/_authenticated/plan/');

/**
 * The milestones over the board (`18-plan-product.md` §2): one card per milestone of the
 * projects shown. A card filters the board to its milestone and back; its "…"
 * edits it. The strip owns the milestone dialog, since New milestone and every Edit are
 * its own buttons.
 */
export function MilestonesStrip() {
  const { t } = useTranslation();
  const locale = useLocale();
  const filter = useBoardFilter();
  const navigate = board.useNavigate();
  const milestones = useMilestones({
    select: (rows) =>
      rows.filter((milestone) => !filter.projectId || milestone.projectId === filter.projectId),
  });
  const { data: projectNames } = useProjects({
    select: (rows) => new Map(rows.map((row) => [row.id, row.isUnassigned ? '' : row.name])),
  });
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  return (
    <section aria-label={t('tasks.milestones.label')} className="flex flex-col gap-3">
      <div className="flex items-center px-1">
        <span className="eyebrow flex-1">{t('tasks.milestones.title')}</span>
        <Button variant="ghost" size="sm" onClick={() => setEditing('new')}>
          <Plus />
          {t('tasks.milestones.new')}
        </Button>
      </div>
      {milestones.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : milestones.isError ? (
        <ErrorAlert error={milestones.error} fallback={t('tasks.milestones.loadFailed')} />
      ) : (
        <MilestoneGrid>
          {milestones.data.map((milestone) => (
            <MilestoneCard
              key={milestone.id}
              name={milestone.name}
              meta={
                <>
                  {projectNames?.get(milestone.projectId) || t('tasks.sidebar.unassigned')}{' '}
                  <span className="text-fg-subtle">·</span>{' '}
                  <span className="figures">
                    {milestone.targetDate
                      ? formatCalendarDay(milestone.targetDate, locale, 'short')
                      : t('tasks.milestones.noTarget')}
                  </span>
                </>
              }
              done={milestone.doneCount}
              total={milestone.totalCount}
              countLabel={t('tasks.milestones.progress', {
                done: milestone.doneCount,
                total: milestone.totalCount,
              })}
              selected={filter.milestoneId === milestone.id}
              onSelect={() =>
                navigate({
                  search: (previous) => ({
                    ...previous,
                    milestone: previous.milestone === milestone.id ? undefined : milestone.id,
                  }),
                  replace: true,
                })
              }
              action={
                <IconButton
                  size="sm"
                  aria-label={t('tasks.milestones.edit', { name: milestone.name })}
                  onClick={() => setEditing(milestone.id)}
                >
                  <Ellipsis />
                </IconButton>
              }
            />
          ))}
          {milestones.data.length === 0 ? (
            <MilestoneEmpty
              title={t('tasks.milestones.emptyTitle')}
              onClick={() => setEditing('new')}
            >
              {t('tasks.milestones.empty')}
            </MilestoneEmpty>
          ) : null}
        </MilestoneGrid>
      )}
      {editing ? (
        <MilestoneDialog
          milestoneId={editing === 'new' ? undefined : editing}
          projectId={filter.projectId || undefined}
          onClose={() => setEditing(null)}
          onDeleted={(id) => {
            setEditing(null);
            if (filter.milestoneId === id) {
              navigate({
                search: (previous) => ({ ...previous, milestone: undefined }),
                replace: true,
              });
            }
          }}
        />
      ) : null}
    </section>
  );
}
