import { FieldDescription } from '@oppenheimer/design-system-web';
import {
  useCreateTask,
  useDeleteTask,
  useSuspensePlan,
  useUpdateTask,
  useVoiceDictation,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { ConfirmDialog, ErrorAlert, notifySuccess } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskForm } from '../forms/task-form';
import { useBoardFilter } from '../hooks/use-board-filter';
import { useToday } from '../hooks/use-today';
import { filingOf } from '../lib/board';
import { newTaskValues, type TaskFormOutput, taskValues } from '../lib/task-form';
import { TaskSessionsRow } from './task-sessions-row';

/**
 * The task dialog's body: the task (or a new one's values, filed where the
 * board is filtered), the projects and milestones its rows offer, and the three
 * writes. The form takes values and hands them back. It reads under
 * Suspense, in the dialog's `QueryState`; a refetch that fails keeps the
 * form and says so above it.
 */
export function TaskEditor({ taskId, onClose }: { taskId?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const voice = useVoiceDictation();
  const today = useToday();
  const filter = useBoardFilter();
  const { tasks, projects, milestones, error } = useSuspensePlan();
  const task = taskId ? tasks.find((row) => row.id === taskId) : undefined;
  const [deleting, setDeleting] = useState(false);
  const create = useCreateTask({
    onSuccess: () => {
      notifySuccess('taskAdded');
      onClose();
    },
  });
  const update = useUpdateTask({ onSuccess: onClose });
  const remove = useDeleteTask({
    onSuccess: () => {
      notifySuccess('taskDeleted');
      onClose();
    },
  });

  const alert = <ErrorAlert error={error} fallback={t('tasks.dialog.loadFailed')} />;
  if (taskId && !task)
    return (
      <>
        {alert}
        <FieldDescription>{t('tasks.dialog.gone')}</FieldDescription>
      </>
    );

  const unassigned = projects.find((row) => row.isUnassigned);
  const choices = [
    ...(unassigned ? [{ id: unassigned.id, name: t('tasks.sidebar.unassigned') }] : []),
    ...projects.filter((row) => !row.isUnassigned),
  ];
  const filing = filingOf(filter, milestones, unassigned?.id);
  const values = task
    ? taskValues(task)
    : newTaskValues(filing.projectId ?? '', filing.milestoneId);
  const pending = create.isPending || update.isPending;
  const failure = create.error ?? update.error;
  const submit = (next: TaskFormOutput) => {
    const input = { ...next, notes: next.notes?.trim() ?? '' };
    if (task) update.mutate({ id: task.id, input });
    else create.mutate(input);
  };

  return (
    <>
      {alert}
      <TaskForm
        values={values}
        projects={choices}
        milestones={milestones}
        today={today}
        sessions={task ? <TaskSessionsRow task={task} /> : null}
        voice={voice}
        pending={pending}
        error={failure ? resolveError(failure, t('tasks.dialog.saveFailed')) : null}
        submitLabel={t(task ? 'tasks.dialog.save' : 'tasks.dialog.add')}
        onSubmit={submit}
        onCancel={onClose}
        onDelete={task ? () => setDeleting(true) : undefined}
      />
      {deleting && task ? (
        <ConfirmDialog
          title={t('tasks.dialog.deleteTitle')}
          description={t('tasks.dialog.deleteDescription', { title: task.title })}
          confirmLabel={t('tasks.dialog.delete')}
          pending={remove.isPending}
          error={remove.error}
          errorFallback={t('tasks.dialog.deleteFailed')}
          onClose={() => setDeleting(false)}
          onConfirm={() => remove.mutate(task.id)}
        />
      ) : null}
    </>
  );
}
