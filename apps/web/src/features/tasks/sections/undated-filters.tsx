import {
  Button,
  dotVariants,
  SearchableFacetMultiSelect,
  TASK_STATUS_STATE,
} from '@oppenheimer/design-system-web';
import { Folder, ListChecks } from '@oppenheimer/design-system-web/icons';
import { useSuspensePlan } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import {
  isOpenStatus,
  NO_UNDATED_FILTER,
  OPEN_STATUSES,
  type UndatedFilter,
  undatedCounts,
} from '../lib/todo';

/** The facets' first option: nothing narrowed. */
const ALL = 'all';

/**
 * Add undated tasks' filter row: Project (only the projects with an undated
 * task, or one already picked) and Status (the open columns, each with its
 * dot), each option counting what it would leave under the other facet, and
 * Clear while either narrows. The filter is the picker's; this draws it.
 */
export function UndatedFilters({
  filter,
  onChange,
}: {
  filter: UndatedFilter;
  onChange: (filter: UndatedFilter) => void;
}) {
  const { t } = useTranslation();
  // A refetch that fails is not drawn here: the list below says it, from the same read.
  const read = useSuspensePlan();
  const counts = undatedCounts(read.tasks, filter);
  const narrowed = filter.projectIds.length > 0 || filter.statuses.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchableFacetMultiSelect
        variant="pill"
        label={t('tasks.filters.project')}
        icon={<Folder />}
        searchPlaceholder={t('common.search.projects')}
        emptyText={(query) => t('common.search.noMatch', { query })}
        values={filter.projectIds}
        onValuesChange={(projectIds) => onChange({ ...filter, projectIds })}
        options={[
          { value: ALL, label: t('tasks.filters.allProjects') },
          ...read.projects
            .filter((row) => counts.byProject[row.id] || filter.projectIds.includes(row.id))
            .map((row) => ({
              value: row.id,
              label: row.isUnassigned ? t('tasks.filters.noProject') : row.name,
              count: counts.byProject[row.id] ?? 0,
            })),
        ]}
      />
      <SearchableFacetMultiSelect
        variant="pill"
        label={t('tasks.dialog.status')}
        icon={<ListChecks />}
        searchPlaceholder={t('tasks.todo.schedule.searchStatuses')}
        emptyText={(query) => t('common.search.noMatch', { query })}
        values={filter.statuses}
        onValuesChange={(next) => onChange({ ...filter, statuses: next.filter(isOpenStatus) })}
        options={[
          { value: ALL, label: t('tasks.todo.schedule.allStatuses') },
          ...OPEN_STATUSES.map((status) => ({
            value: status,
            label: t(`tasks.columns.${status}`),
            leading: (
              <span aria-hidden className={dotVariants({ state: TASK_STATUS_STATE[status] })} />
            ),
            count: counts.byStatus[status] ?? 0,
          })),
        ]}
      />
      {narrowed ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(NO_UNDATED_FILTER)}>
          {t('tasks.filters.clear')}
        </Button>
      ) : null}
    </div>
  );
}
