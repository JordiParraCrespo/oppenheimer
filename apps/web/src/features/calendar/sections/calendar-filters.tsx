import { Button, FacetSelect, SearchableFacetMultiSelect } from '@oppenheimer/design-system-web';
import { CircleCheck, Layers, UserRound } from '@oppenheimer/design-system-web/icons';
import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, ProjectFacet, projectParamOf } from '@oppenheimer/frontend-web';
import { TASK_ORIGINS, TASK_STATUSES } from '@oppenheimer/shared/schemas/task';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useCalendarScope } from '../hooks/use-calendar-scope';
import {
  CALENDAR_LAYERS,
  type CalendarSearch,
  offParamOf,
  shownLayers,
  statusParamOf,
} from '../lib/calendar-search';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/** The facets' first option: nothing narrowed. */
const ALL = 'all';

/**
 * The calendar's filter row: Kind (the same switch as the sidebar's
 * Calendars), Project, Status and Added by, each kept in the address so a
 * link shows the same calendar, and Clear while any narrows it. Project
 * narrows tasks and automation runs; Status and Added by narrow tasks;
 * events have none of the three, so only Kind hides them.
 */
export function CalendarFilters() {
  const { t } = useTranslation();
  const { slugs, statuses, origin } = useCalendarScope();
  const off = calendar.useSearch({ select: (search) => search.off });
  const { data: projects, error: projectsError } = useProjects();
  const navigate = calendar.useNavigate();
  const set = (next: Partial<CalendarSearch>) =>
    navigate({ search: (previous) => ({ ...previous, ...next }), replace: true });
  const kinds = shownLayers(off);
  const narrowed = kinds.length || slugs.length || statuses.length || origin;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchableFacetMultiSelect
          variant="pill"
          label={t('calendar.filters.kind')}
          icon={<Layers />}
          searchPlaceholder={t('calendar.filters.searchKinds')}
          emptyText={(query) => t('common.search.noMatch', { query })}
          values={kinds}
          onValuesChange={(next) => set({ off: offParamOf(next) })}
          options={[
            { value: ALL, label: t('calendar.filters.allKinds') },
            ...CALENDAR_LAYERS.map((layer) => ({
              value: layer,
              label: t(`calendar.layers.${layer}`),
            })),
          ]}
        />
        <ProjectFacet
          projects={projects}
          values={slugs}
          onValuesChange={(next) => set({ project: projectParamOf(next) })}
        />
        <SearchableFacetMultiSelect
          variant="pill"
          label={t('calendar.filters.status')}
          icon={<CircleCheck />}
          searchPlaceholder={t('calendar.filters.searchStatuses')}
          emptyText={(query) => t('common.search.noMatch', { query })}
          values={statuses}
          onValuesChange={(next) => set({ status: statusParamOf(next) })}
          options={[
            { value: ALL, label: t('calendar.filters.allStatuses') },
            ...TASK_STATUSES.map((status) => ({
              value: status,
              label: t(`tasks.columns.${status}`),
            })),
          ]}
        />
        <FacetSelect
          variant="pill"
          label={t('calendar.filters.origin')}
          icon={<UserRound />}
          value={origin ?? ALL}
          onValueChange={(value) => set({ origin: TASK_ORIGINS.find((name) => name === value) })}
          options={[
            { value: ALL, label: t('calendar.filters.anyOrigin') },
            { value: 'person', label: t('calendar.filters.originPerson') },
            { value: 'agent', label: t('calendar.filters.originAgent') },
          ]}
        />
        {narrowed ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              set({ off: undefined, project: undefined, status: undefined, origin: undefined })
            }
          >
            {t('calendar.filters.clear')}
          </Button>
        ) : null}
      </div>
      {slugs.length ? (
        <ErrorAlert error={projectsError} fallback={t('calendar.filters.projectsFailed')} />
      ) : null}
    </div>
  );
}
