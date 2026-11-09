import {
  Button,
  DialogDescription,
  dotVariants,
  EmptyState,
  SearchList,
  TASK_STATUS_STATE,
} from '@oppenheimer/design-system-web';
import { useSuspensePlan, useUpdateTask } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatCalendarDay, useLocale } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScopeProject } from '../hooks/use-scope-project';
import { useTodoDay } from '../hooks/use-todo-day';
import { undatedTasks } from '../lib/todo';

/**
 * Add undated tasks' list, in `ScheduleUndatedDialog`'s `QueryState.Data`:
 * the open tasks with no due date in the projects To do is narrowed to, each
 * with its column's dot, checked into a set; Add gives every checked
 * one the day shown as its due date, side by side. Those that fail stay
 * checked and the dialog stays open saying so; when none fails it closes,
 * and the tasks land on the list behind it.
 */
export function UndatedPicker({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { day } = useTodoDay();
  const { projectIds } = useScopeProject();
  const read = useSuspensePlan();
  const update = useUpdateTask();
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const projects = new Map(read.projects.map((row) => [row.id, row]));
  const date = formatCalendarDay(day, locale);
  // One line a row: the list caps its height by one-line rows. The column is
  // its dot; the project and the column's name are searched, not shown.
  const options = undatedTasks(read.tasks, projectIds).map((task) => {
    const project = projects.get(task.projectId);
    return {
      value: task.id,
      label: task.title,
      leading: (
        <span aria-hidden className={dotVariants({ state: TASK_STATUS_STATE[task.status] })} />
      ),
      keywords: [project?.name, t(`tasks.columns.${task.status}`)].filter(Boolean).join(' '),
    };
  });

  const add = async () => {
    setPending(true);
    setFailure(null);
    const results = await Promise.allSettled(
      picked.map((id) => update.mutateAsync({ id, input: { dueDate: day } })),
    );
    setPending(false);
    const failed = picked.filter((_, index) => results[index].status === 'rejected');
    if (failed.length === 0) return onClose();
    const first = results.find((result) => result.status === 'rejected');
    setFailure(first?.status === 'rejected' ? first.reason : null);
    setPicked(failed);
  };

  return (
    <div className="flex flex-col gap-4">
      <DialogDescription>{t('tasks.todo.schedule.for', { date })}</DialogDescription>
      <ErrorAlert error={read.error} fallback={t('tasks.todo.schedule.loadFailed')} />
      <ErrorAlert error={failure} fallback={t('tasks.todo.schedule.failed')} />
      {options.length === 0 ? (
        <EmptyState className="rounded-lg bg-card">
          <EmptyState.Header>
            <EmptyState.Description>{t('tasks.todo.schedule.none')}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      ) : (
        <SearchList
          aria-label={t('tasks.todo.schedule.title')}
          options={options}
          value={picked}
          onPick={(option, selected) =>
            setPicked((previous) =>
              selected ? [...previous, option.value] : previous.filter((id) => id !== option.value),
            )
          }
          searchPlaceholder={t('tasks.todo.schedule.search')}
          emptyText={(query) => t('tasks.todo.schedule.noMatch', { query })}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="button" pending={pending} disabled={picked.length === 0} onClick={add}>
          {t('tasks.todo.schedule.submit', { date })}
        </Button>
      </div>
    </div>
  );
}
