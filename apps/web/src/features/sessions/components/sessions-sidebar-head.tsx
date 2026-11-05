import { SidebarListHead } from '@oppenheimer/design-system-web';
import { SidebarSearchField } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { FilterOption, SessionFacet, SessionFilters } from '../lib/session-filters';
import { SessionFilterChips } from './session-filter-chips';
import { type ProjectVisibility, SessionsFilterMenu } from './sessions-filter-menu';

/**
 * The sidebar's head. The filters and the settled query are the section's
 * state, because the list below is what they narrow; the half-typed query is
 * the search box's own. It draws under the sidebar's Suspense boundary, so
 * the count and the filter menu's options are always the answered ones. The
 * count is the sessions the list below draws, pinned ones included.
 * While rows are picked, `selectionBar` takes the Sessions line's place.
 * Projects are not made or edited from here: that is Plan's Projects view.
 */
export function SessionsSidebarHead({
  sessionCount,
  filters,
  options,
  dirty,
  visibility,
  chips,
  onFiltersChange,
  onFiltersClear,
  onFacetClear,
  onQueryChange,
  selectionBar,
}: {
  sessionCount: number;
  filters: SessionFilters;
  options: Record<SessionFacet, FilterOption[]>;
  dirty: boolean;
  visibility: ProjectVisibility;
  chips: { key: SessionFacet; label: string }[];
  onFiltersChange: (patch: Partial<SessionFilters>) => void;
  onFiltersClear: () => void;
  onFacetClear: (key: SessionFacet) => void;
  onQueryChange: (query: string) => void;
  selectionBar?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <>
      {selectionBar ?? (
        <SidebarListHead label={t('sessions.sidebar.sessions')} count={sessionCount}>
          <SessionsFilterMenu
            filters={filters}
            options={options}
            dirty={dirty}
            visibility={visibility}
            onChange={onFiltersChange}
            onClear={onFiltersClear}
          />
        </SidebarListHead>
      )}

      <SidebarSearchField
        onChange={onQueryChange}
        label={t('sessions.sidebar.search')}
        clearLabel={t('sessions.sidebar.clearSearch')}
      />

      {dirty ? <SessionFilterChips chips={chips} onClear={onFacetClear} /> : null}
    </>
  );
}
