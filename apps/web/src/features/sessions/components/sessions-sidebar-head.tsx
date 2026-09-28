import { IconButton, SidebarSearch } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { FilterOption, SessionFacet, SessionFilters } from '../lib/session-filters';
import { SessionFilterChips } from './session-filter-chips';
import { SessionsFilterMenu } from './sessions-filter-menu';

/**
 * The sidebar's head: New session, the Projects line (count, New project,
 * the filter menu), the live search and the active-filter chips.
 *
 * Props in, choice out: the filters and the query are the section's state,
 * because the list under the head is what they narrow. `projectCount` is
 * absent until the projects have settled — a zero under a request that has
 * not answered reads as "you have none", which is a different thing from
 * "not yet known" — and the filter menu waits for the sessions the same way.
 */
export function SessionsSidebarHead({
  newSession,
  projectCount,
  filters,
  options,
  dirty,
  chips,
  query,
  onFiltersChange,
  onFiltersClear,
  onFacetClear,
  onQueryChange,
  onNewProject,
}: {
  /** The New session button, a section of its own: a component reads no route. */
  newSession: ReactElement;
  projectCount: number | undefined;
  filters: SessionFilters;
  options: Record<SessionFacet, FilterOption[]> | undefined;
  dirty: boolean;
  chips: { key: SessionFacet; label: string }[];
  query: string;
  onFiltersChange: (patch: Partial<SessionFilters>) => void;
  onFiltersClear: () => void;
  onFacetClear: (key: SessionFacet) => void;
  onQueryChange: (query: string) => void;
  onNewProject: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="px-3 pb-2.5">{newSession}</div>

      <div className="flex items-center gap-2 px-3 pt-0.5 pb-1.5">
        <span className="eyebrow min-w-0 flex-1 font-normal tracking-[0.04em] text-fg-muted">
          {t('sessions.sidebar.projects')}
        </span>
        {projectCount !== undefined ? (
          <span className="figures text-[11px] text-fg-muted">{projectCount}</span>
        ) : null}
        <IconButton
          size="xs"
          variant="quiet"
          aria-label={t('sessions.sidebar.newProject')}
          onClick={onNewProject}
        >
          <Plus />
        </IconButton>
        {options ? (
          <SessionsFilterMenu
            filters={filters}
            options={options}
            dirty={dirty}
            onChange={onFiltersChange}
            onClear={onFiltersClear}
          />
        ) : null}
      </div>

      <SidebarSearch
        value={query}
        onValueChange={onQueryChange}
        placeholder={t('sessions.sidebar.search')}
        aria-label={t('sessions.sidebar.search')}
        clearLabel={t('sessions.sidebar.clearSearch')}
      />

      {dirty ? <SessionFilterChips chips={chips} onClear={onFacetClear} /> : null}
    </>
  );
}
