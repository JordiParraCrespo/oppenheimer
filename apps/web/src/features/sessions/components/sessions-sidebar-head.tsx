import { IconButton, SidebarListHead } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { SidebarSearchField } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import type { FilterOption, SessionFacet, SessionFilters } from '../lib/session-filters';
import { SessionFilterChips } from './session-filter-chips';
import { SessionsFilterMenu } from './sessions-filter-menu';

/**
 * The sidebar's head. The filters and the settled query are the section's
 * state, because the list below is what they narrow; the half-typed query is
 * the search box's own. It draws under the sidebar's Suspense boundary, so
 * the count and the filter menu's options are always the answered ones.
 */
export function SessionsSidebarHead({
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
  projectCount: number;
  filters: SessionFilters;
  options: Record<SessionFacet, FilterOption[]>;
  dirty: boolean;
  chips: { key: SessionFacet; label: string }[];
  onFiltersChange: (patch: Partial<SessionFilters>) => void;
  onFiltersClear: () => void;
  onFacetClear: (key: SessionFacet) => void;
  onQueryChange: (query: string) => void;
  onNewProject: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <SidebarListHead label={t('sessions.sidebar.projects')} count={projectCount}>
        <IconButton
          size="xs"
          variant="quiet"
          aria-label={t('sessions.sidebar.newProject')}
          onClick={onNewProject}
        >
          <Plus />
        </IconButton>
        <SessionsFilterMenu
          filters={filters}
          options={options}
          dirty={dirty}
          onChange={onFiltersChange}
          onClear={onFiltersClear}
        />
      </SidebarListHead>

      <SidebarSearchField
        onChange={onQueryChange}
        label={t('sessions.sidebar.search')}
        clearLabel={t('sessions.sidebar.clearSearch')}
      />

      {dirty ? <SessionFilterChips chips={chips} onClear={onFacetClear} /> : null}
    </>
  );
}
