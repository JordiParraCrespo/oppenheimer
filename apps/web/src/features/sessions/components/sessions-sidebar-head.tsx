import { IconButton, SidebarListHead } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { FilterOption, SessionFacet, SessionFilters } from '../lib/session-filters';
import { SessionFilterChips } from './session-filter-chips';
import { SessionsFilterMenu } from './sessions-filter-menu';
import { SessionsSearch } from './sessions-search';

/**
 * The sidebar's head: New session, the Projects line (count, New project,
 * the filter menu), the live search and the active-filter chips.
 *
 * Props in, choice out: the filters and the settled query are the section's
 * state, because the list under the head is what they narrow; the half-typed
 * query is the search box's own. `projectCount` is
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
  onFiltersChange: (patch: Partial<SessionFilters>) => void;
  onFiltersClear: () => void;
  onFacetClear: (key: SessionFacet) => void;
  /** The settled search, once per burst of typing. */
  onQueryChange: (query: string) => void;
  onNewProject: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="px-3 pb-2.5">{newSession}</div>

      <SidebarListHead label={t('sessions.sidebar.projects')} count={projectCount}>
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
      </SidebarListHead>

      <SessionsSearch onChange={onQueryChange} />

      {dirty ? <SessionFilterChips chips={chips} onClear={onFacetClear} /> : null}
    </>
  );
}
