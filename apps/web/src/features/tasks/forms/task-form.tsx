import { Button, FieldError, Input, Textarea } from '@oppenheimer/design-system-web';
import { ErrorAlert, type ResolvedErrorMessage, useZodResolver } from '@oppenheimer/frontend-web';
import { createTaskSchema, TASK_STATUSES } from '@oppenheimer/shared/schemas/task';
import type { ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ChoiceRow } from '../components/choice-row';
import type { TaskFormInput, TaskFormOutput, TaskFormValues } from '../lib/task-form';
import { TaskDueRow } from './task-due-row';
import { TaskGoalRow } from './task-goal-row';

/**
 * The task dialog's form (`Tasks.dc.html`): the title and notes as plain text at
 * the top, then the rows — Status, Project, Goal, the sessions (the dialog's,
 * passed in), Due — and the footer. Enter in the title saves.
 */
export function TaskForm({
  values,
  projects,
  goals,
  today,
  sessions,
  pending,
  error,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: {
  values: TaskFormValues;
  projects: readonly { id: string; name: string }[];
  goals: readonly { id: string; name: string; projectId: string }[];
  today: string;
  /** The Sessions row, for a task that exists. */
  sessions: ReactNode;
  pending: boolean;
  error: ResolvedErrorMessage | null;
  submitLabel: string;
  onSubmit: (values: TaskFormOutput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const { register, control, handleSubmit, setValue, getValues, formState } = useForm<
    TaskFormInput,
    unknown,
    TaskFormOutput
  >({
    resolver: useZodResolver(createTaskSchema),
    values,
  });

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col gap-1.5">
        <Input
          {...register('title')}
          className="h-auto border-0 bg-transparent px-0 text-h3 font-semibold hover:border-0 has-focus-visible:ring-0"
          placeholder={t('tasks.dialog.titlePlaceholder')}
          aria-label={t('tasks.dialog.titleLabel')}
          aria-invalid={Boolean(formState.errors.title)}
          autoFocus
        />
        <FieldError errors={[formState.errors.title]} />
        <Textarea
          {...register('notes')}
          rows={3}
          className="min-h-0 resize-none border-0 bg-transparent px-0 py-0 text-fg-muted hover:border-0 focus-visible:ring-0"
          placeholder={t('tasks.dialog.notesPlaceholder')}
          aria-label={t('tasks.dialog.notesLabel')}
        />
      </div>
      <div className="flex flex-col gap-3 border-t border-border-subtle pt-5">
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <ChoiceRow
              label={t('tasks.dialog.status')}
              choices={TASK_STATUSES.map((status) => ({
                value: status,
                label: t(`tasks.columns.${status}`),
              }))}
              value={field.value ?? null}
              onChange={(value) => value && field.onChange(value)}
            />
          )}
        />
        <Controller
          control={control}
          name="projectId"
          render={({ field }) => (
            <ChoiceRow
              label={t('tasks.dialog.project')}
              choices={projects.map((project) => ({ value: project.id, label: project.name }))}
              value={field.value ?? null}
              onChange={(value) => {
                if (!value) return;
                field.onChange(value);
                // A goal of another project goes with the change (18 §3).
                const goalId = getValues('goalId');
                if (
                  goalId &&
                  !goals.some((goal) => goal.id === goalId && goal.projectId === value)
                ) {
                  setValue('goalId', null);
                }
              }}
            />
          )}
        />
        <TaskGoalRow control={control} goals={goals} />
        {sessions}
        <TaskDueRow control={control} today={today} />
      </div>
      <ErrorAlert message={error?.message} correlationId={error?.correlationId} />
      <div className="flex items-center gap-2">
        {onDelete ? (
          <Button type="button" variant="destructive-ghost" onClick={onDelete}>
            {t('tasks.dialog.delete')}
          </Button>
        ) : null}
        <span className="flex-1" />
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" pending={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
