import { Button, SearchableFacetMultiSelect, Skeleton } from '@oppenheimer/design-system-web';
import { Folder } from '@oppenheimer/design-system-web/icons';
import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { projectParamOf, UNASSIGNED_SLUG } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useCalendarProjects } from '../hooks/use-calendar-projects';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/** The facet's first option: every project. */
const ALL = 'all';

/** The set facet's frame, for a pick whose name has not answered yet. */
const PENDING_FACET =
  'inline-flex h-7.5 shrink-0 items-center gap-1.75 rounded-pill bg-selected-surface px-3 text-selected-fg [&_svg]:size-3.25 [&_svg]:shrink-0';

/**
 * The calendar's filter row, as Plan's board draws it: Project, several picks
 * at once, narrowing the tasks due and automation runs to those projects
 * (events have no project, so the layers alone hide them), and Clear while
 * it narrows. Kept in the address, so a link shows the same calendar.
 */
export function CalendarFilters() {
  const { t } = useTranslation();
  const { slugs } = useCalendarProjects();
  const { data: projects } = useProjects();
  const navigate = calendar.useNavigate();
  const unassigned = projects?.find((row) => row.isUnassigned);
  const pick = (next: readonly string[]) =>
    navigate({
      search: (previous) => ({ ...previous, project: projectParamOf(next) }),
      replace: true,
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {slugs.length && projects === undefined ? (
        <span aria-hidden className={PENDING_FACET}>
          <Folder />
          <Skeleton shape="sm" className="h-2.5 w-16" />
        </span>
      ) : (
        <SearchableFacetMultiSelect
          variant="pill"
          label={t('calendar.filters.project')}
          icon={<Folder />}
          searchPlaceholder={t('common.search.projects')}
          emptyText={(query) => t('common.search.noMatch', { query })}
          values={slugs}
          onValuesChange={pick}
          options={[
            { value: ALL, label: t('calendar.filters.allProjects') },
            ...(projects ?? [])
              .filter((row) => !row.isUnassigned)
              .map((row) => ({ value: row.slug, label: row.name })),
            ...(unassigned
              ? [{ value: UNASSIGNED_SLUG, label: t('calendar.filters.noProject') }]
              : []),
          ]}
        />
      )}
      {slugs.length ? (
        <Button variant="ghost" size="sm" onClick={() => pick([])}>
          {t('calendar.filters.clear')}
        </Button>
      ) : null}
    </div>
  );
}
