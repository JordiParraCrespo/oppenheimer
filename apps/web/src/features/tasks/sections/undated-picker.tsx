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
import { NO_UNDATED_FILTER, picksInView, type UndatedFilter, undatedTasks } from '../lib/todo';
import { UndatedFilters } from './undated-filters';

/**
 * Add undated tasks' list, in `ScheduleUndatedDialog`'s `QueryState.Data`:
 * the open tasks with no due date, each with its column's dot, checked into
 * a set, under `UndatedFilters`; the filter starts at the projects To do is
 * narrowed to and lives in the dialog, not the address. Add gives every
 * checked task the filters still show the day as its due date, side by side. Those that fail stay
 * checked and the dialog stays open saying so; when none fails it closes,
 * and the tasks land on the list behind it. While Add runs the checks hold.
 */
export function UndatedPicker({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { day } = useTodoDay();
  const scope = useScopeProject();
  const [filter, setFilter] = useState<UndatedFilter>(() => ({
    ...NO_UNDATED_FILTER,
    projectIds: scope.projectIds ?? [],
  }));
  const read = useSuspensePlan();
  const update = useUpdateTask();
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const projects = new Map(read.projects.map((row) => [row.id, row]));
  const date = formatCalendarDay(day, locale);
  // One line a row: the list caps its height by one-line rows. The column is
  // its dot; the project and the column's name are searched, not shown.
  const anyUndated = undatedTasks(read.tasks).length > 0;
  const shown = undatedTasks(read.tasks, filter);
  const adding = picksInView(picked, shown);
  const options = shown.map((task) => {
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
      adding.map((id) => update.mutateAsync({ id, input: { dueDate: day } })),
    );
    setPending(false);
    const failed = adding.filter((_, index) => results[index].status === 'rejected');
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
      {anyUndated ? <UndatedFilters filter={filter} onChange={setFilter} /> : null}
      {options.length === 0 ? (
        <EmptyState className="rounded-lg bg-card">
          <EmptyState.Header>
            <EmptyState.Description>
              {anyUndated ? t('tasks.todo.noMatch') : t('tasks.todo.schedule.none')}
            </EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      ) : (
        <SearchList
          aria-label={t('tasks.todo.schedule.title')}
          options={options}
          value={picked}
          onPick={(option, selected) => {
            // The batch in flight is what is checked: a pick now would be dropped.
            if (pending) return;
            setPicked((previous) =>
              selected ? [...previous, option.value] : previous.filter((id) => id !== option.value),
            );
          }}
          searchPlaceholder={t('tasks.todo.schedule.search')}
          emptyText={(query) => t('tasks.todo.schedule.noMatch', { query })}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="button" pending={pending} disabled={adding.length === 0} onClick={add}>
          {t('tasks.todo.schedule.submit', { date })}
        </Button>
      </div>
    </div>
  );
}
