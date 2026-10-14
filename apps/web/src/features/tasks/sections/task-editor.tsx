import { FieldDescription, Skeleton } from '@oppenheimer/design-system-web';
import type { ProjectEntity, TaskEntity } from '@oppenheimer/frontend-consumer';
import {
  useCreateTask,
  useDeleteTask,
  useMilestones,
  useProjects,
  useTasks,
  useUpdateTask,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import {
  ConfirmDialog,
  combineQueries,
  notifySuccess,
  QueryState,
} from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskForm } from '../forms/task-form';
import { useBoardFilter } from '../hooks/use-board-filter';
import { useToday } from '../hooks/use-today';
import { newTaskValues, type TaskFormOutput, taskValues } from '../lib/task-form';
import { TaskSessionsRow } from './task-sessions-row';

/**
 * The task dialog's body: the task (or a new one's values, filed where the
 * board is filtered), the projects and milestones its rows offer, and the three
 * writes. The form takes values and hands them back.
 */
export function TaskEditor({ taskId, onClose }: { taskId?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const today = useToday();
  const filter = useBoardFilter();
  const tasks = useTasks({ select: (rows) => rows.find((row) => row.id === taskId) ?? null });
  const projects = useProjects();
  // Milestones only fill the milestone row's options: a failed read leaves
  // that row empty and the task still saves, so it does not gate the form.
  const { data: milestones } = useMilestones();
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

  const pending = create.isPending || update.isPending;
  const failure = create.error ?? update.error;
  const editor = (task: TaskEntity | null, projects: ProjectEntity[]) => {
    const unassigned = projects.find((row) => row.isUnassigned);
    const choices = [
      ...(unassigned ? [{ id: unassigned.id, name: t('tasks.sidebar.unassigned') }] : []),
      ...projects.filter((row) => !row.isUnassigned),
    ];
    const values = task
      ? taskValues(task)
      : newTaskValues(filter.projectId || unassigned?.id || '', filter.milestoneId ?? null);
    const submit = (next: TaskFormOutput) => {
      const input = { ...next, notes: next.notes?.trim() ?? '' };
      if (task) update.mutate({ id: task.id, input });
      else create.mutate(input);
    };

    return (
      <>
        <TaskForm
          values={values}
          projects={choices}
          milestones={milestones ?? []}
          today={today}
          sessions={task ? <TaskSessionsRow task={task} /> : null}
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
  };

  // A new task needs only the projects; the task list gates the dialog only
  // when it holds the task being edited.
  if (!taskId) {
    return (
      <QueryState query={projects} stale="keep">
        <QueryState.Pending>
          <Skeleton className="h-60 w-full" />
        </QueryState.Pending>
        <QueryState.Error fallback={t('tasks.dialog.loadFailed')} />
        <QueryState.Data of={projects}>{(rows) => editor(null, rows)}</QueryState.Data>
      </QueryState>
    );
  }

  const editing = combineQueries(tasks, projects, (task, rows) => ({ task, projects: rows }));
  return (
    <QueryState query={editing} isEmpty={({ task }) => !task} stale="keep">
      <QueryState.Pending>
        <Skeleton className="h-60 w-full" />
      </QueryState.Pending>
      <QueryState.Error fallback={t('tasks.dialog.loadFailed')} />
      <QueryState.Empty>
        <FieldDescription>{t('tasks.dialog.gone')}</FieldDescription>
      </QueryState.Empty>
      <QueryState.Data of={editing}>
        {({ task, projects: rows }) => editor(task, rows)}
      </QueryState.Data>
    </QueryState>
  );
}
