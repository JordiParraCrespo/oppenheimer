import {
  Button,
  DialogDescription,
  dotVariants,
  EmptyState,
  SearchableFacetMultiSelect,
  SearchList,
  TASK_STATUS_STATE,
} from '@oppenheimer/design-system-web';
import { Folder, ListChecks } from '@oppenheimer/design-system-web/icons';
import type { TaskEntity } from '@oppenheimer/frontend-consumer';
import { useSuspensePlan, useUpdateTask } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatCalendarDay, useLocale } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScopeProject } from '../hooks/use-scope-project';
import { useTodoDay } from '../hooks/use-todo-day';
import { undatedCounts, undatedTasks } from '../lib/todo';

/** The facets' first option: nothing narrowed. */
const ALL = 'all';

/** The columns an undated task can be offered from: every open one. */
const OPEN_STATUSES: readonly TaskEntity['status'][] = ['todo', 'doing', 'review'];

/**
 * Add undated tasks' list, in `ScheduleUndatedDialog`'s `QueryState.Data`:
 * the open tasks with no due date, each with its column's dot, checked into
 * a set. Above it, Project (starting at the projects To do is narrowed to)
 * and Status narrow the list, each option counting what it would show under
 * the other facet; they live in the dialog, not the address. Add gives every
 * checked task the filters still show the day as its due date, side by side. Those that fail stay
 * checked and the dialog stays open saying so; when none fails it closes,
 * and the tasks land on the list behind it. While Add runs the checks hold.
 */
export function UndatedPicker({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { day } = useTodoDay();
  const scope = useScopeProject();
  const [projectIds, setProjectIds] = useState<string[]>(() => [...(scope.projectIds ?? [])]);
  const [statuses, setStatuses] = useState<TaskEntity['status'][]>([]);
  const read = useSuspensePlan();
  const update = useUpdateTask();
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const projects = new Map(read.projects.map((row) => [row.id, row]));
  const date = formatCalendarDay(day, locale);
  // One line a row: the list caps its height by one-line rows. The column is
  // its dot; the project and the column's name are searched, not shown.
  const filter = { projectIds, statuses };
  const counts = undatedCounts(read.tasks, filter);
  const anyUndated = undatedTasks(read.tasks).length > 0;
  const narrowed = projectIds.length > 0 || statuses.length > 0;
  const options = undatedTasks(read.tasks, filter).map((task) => {
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

  // A pick the filters now hide is not added: Add does what the list shows.
  const shown = new Set(options.map((option) => option.value));
  const adding = picked.filter((id) => shown.has(id));

  const projectOptions = [
    { value: ALL, label: t('tasks.filters.allProjects') },
    // Only the projects with an undated task, or one already picked.
    ...read.projects
      .filter((row) => counts.byProject[row.id] || projectIds.includes(row.id))
      .map((row) => ({
        value: row.id,
        label: row.isUnassigned ? t('tasks.filters.noProject') : row.name,
        count: counts.byProject[row.id] ?? 0,
      })),
  ];
  const stateOptions = [
    { value: ALL, label: t('tasks.todo.schedule.allStatuses') },
    ...OPEN_STATUSES.map((status) => ({
      value: status,
      label: t(`tasks.columns.${status}`),
      leading: <span aria-hidden className={dotVariants({ state: TASK_STATUS_STATE[status] })} />,
      count: counts.byStatus[status] ?? 0,
    })),
  ];

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
      {anyUndated ? (
        <div className="flex flex-wrap items-center gap-2">
          <SearchableFacetMultiSelect
            variant="pill"
            label={t('tasks.filters.project')}
            icon={<Folder />}
            searchPlaceholder={t('common.search.projects')}
            emptyText={(query) => t('common.search.noMatch', { query })}
            values={projectIds}
            onValuesChange={setProjectIds}
            options={projectOptions}
          />
          <SearchableFacetMultiSelect
            variant="pill"
            label={t('tasks.dialog.status')}
            icon={<ListChecks />}
            searchPlaceholder={t('tasks.todo.schedule.searchStatuses')}
            emptyText={(query) => t('common.search.noMatch', { query })}
            values={statuses}
            onValuesChange={(next) => setStatuses(next as TaskEntity['status'][])}
            options={stateOptions}
          />
          {narrowed ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setProjectIds([]);
                setStatuses([]);
              }}
            >
              {t('tasks.filters.clear')}
            </Button>
          ) : null}
        </div>
      ) : null}
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
