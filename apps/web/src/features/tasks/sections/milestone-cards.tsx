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
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MilestoneDialog } from '../dialogs/milestone';
import { useScopeProject } from '../hooks/use-scope-project';

/**
 * The Milestones view's cards (`23-plan-milestones-stats-accounts.md` §2): one
 * per milestone of the projects shown, dated or not. A card opens the board
 * filtered to its milestone; its "…" edits it. The section owns the milestone
 * dialog, since New milestone and every Edit are its own buttons.
 */
export function MilestoneCards() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { projectId } = useScopeProject();
  const navigate = useNavigate();
  const milestones = useMilestones({
    select: (rows) => rows.filter((milestone) => !projectId || milestone.projectId === projectId),
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
              onSelect={() => navigate({ to: '/plan', search: { milestone: milestone.id } })}
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
          projectId={projectId || undefined}
          onClose={() => setEditing(null)}
          onDeleted={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}
