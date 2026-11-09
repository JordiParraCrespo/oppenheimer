import { Button, Field, FieldLabel, Skeleton } from '@oppenheimer/design-system-web';
import { Paperclip, Play } from '@oppenheimer/design-system-web/icons';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { TASK_STATUSES } from '@oppenheimer/shared/schemas/task';
import { useTranslation } from 'react-i18next';
import { ChoiceRowSkeleton } from './choice-row-skeleton';

/**
 * The task dialog's form before the plan answers, laid out as `TaskForm` is:
 * the Title and Notes fields with their labels written and the controls at
 * their heights, the rows (Status, Project, Milestone, Sessions for a task
 * that exists, Due) with their labels written, the choices that need no data
 * (the four statuses, None) as unpicked pills and a bar for each other one,
 * the Sessions row's Start session and Link existing, and the footer's
 * buttons (Delete among them for a task that exists), all drawn disabled.
 */
export function TaskEditorSkeleton({ existing }: { existing: boolean }) {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-5">
      <LoadingStatus />
      <Field>
        <FieldLabel>{t('tasks.dialog.titleLabel')}</FieldLabel>
        <Skeleton shape="sm" className="h-(--control-h-md) w-full" />
      </Field>
      <Field>
        <FieldLabel>{t('tasks.dialog.notesLabel')}</FieldLabel>
        {/* A block stands in here: the notes' textarea, at its least height. */}
        <Skeleton shape="sm" className="h-22 w-full" />
      </Field>
      <div className="flex flex-col gap-3 border-t border-border-subtle pt-5">
        <ChoiceRowSkeleton
          label={t('tasks.dialog.status')}
          written={TASK_STATUSES.map((status) => t(`tasks.columns.${status}`))}
        />
        <ChoiceRowSkeleton label={t('tasks.dialog.project')} widths={['w-28', 'w-24']} />
        <ChoiceRowSkeleton
          label={t('tasks.dialog.milestone')}
          written={[t('tasks.dialog.none')]}
          widths={['w-26']}
        />
        {existing ? (
          <div className="grid grid-cols-[96px_1fr] items-start gap-3">
            <span className="pt-1 text-sm text-fg-muted">{t('tasks.dialog.sessions')}</span>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="secondary" size="sm" disabled>
                <Play />
                {t('tasks.dialog.startSession')}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled>
                <Paperclip />
                {t('tasks.dialog.linkExisting')}
              </Button>
            </div>
          </div>
        ) : null}
        <ChoiceRowSkeleton label={t('tasks.dialog.due')} align="center">
          <Skeleton shape="sm" className="h-(--control-h-md) w-40" />
          <Skeleton shape="sm" className="h-(--control-h-md) w-24" />
        </ChoiceRowSkeleton>
      </div>
      <div className="flex items-center gap-2">
        {existing ? (
          <Button type="button" variant="destructive-ghost" disabled>
            {t('tasks.dialog.delete')}
          </Button>
        ) : null}
        <span className="flex-1" />
        <Button type="button" variant="ghost" disabled>
          {t('common.cancel')}
        </Button>
        <Button type="button" disabled>
          {t(existing ? 'tasks.dialog.save' : 'tasks.dialog.add')}
        </Button>
      </div>
    </div>
  );
}
