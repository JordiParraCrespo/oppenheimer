import { Button, Checkbox, cn } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  DataTableAction,
  DataTableFacet,
  DataTableSearch as DataTableSearchProps,
} from '../lib/data-table-types';
import { TABLE_HEADER_CONTROL_SIZE } from '../lib/data-table-types';
import { DataTableSearch } from './data-table-search';
import { FacetFilter } from './facet-filter';

/**
 * The card's top bar: search, filters and the page's primary action, swapping
 * to a selection toolbar the moment a row is ticked.
 *
 * Split from the body it sits above so the two stop sharing a render. Picking a
 * filter, opening a facet or ticking the last row changes what the bar shows
 * and nothing about the rows; the body is memoised on its own props and sits
 * this out.
 */
export function DataTableHeader({
  search,
  facets,
  actions,
  addAction,
  selectedCount,
  selectedOnPage,
  clearSelection,
  bulkActions,
}: {
  search?: DataTableSearchProps;
  facets?: DataTableFacet[];
  actions?: DataTableAction[];
  addAction?: DataTableAction;
  selectedCount: number;
  selectedOnPage: string[];
  clearSelection: () => void;
  bulkActions?: (selected: string[], clearSelection: () => void) => ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'flex min-h-15 flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-3 transition-colors',
        selectedCount > 0 && 'bg-surface-sunken',
      )}
    >
      {selectedCount > 0 ? (
        <>
          <div className="mr-auto flex items-center gap-2.5">
            <Checkbox
              checked
              indeterminate
              onClick={clearSelection}
              aria-label={t('table.clearSelection')}
            />
            <span className="text-base font-medium text-ink-900">
              {t('table.selected', { count: selectedCount })}
            </span>
          </div>
          {bulkActions?.(selectedOnPage, clearSelection)}
        </>
      ) : (
        <>
          {search && <DataTableSearch {...search} />}
          <div className="ml-auto flex items-center gap-2">
            {facets?.map((facet) => (
              <FacetFilter key={facet.label} facet={facet} />
            ))}
            {actions?.map((action) => (
              <Button
                key={action.label}
                variant="secondary"
                size={TABLE_HEADER_CONTROL_SIZE}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
            {addAction && (
              <Button
                size={TABLE_HEADER_CONTROL_SIZE}
                onClick={addAction.onClick}
                disabled={addAction.disabled}
              >
                {addAction.icon}
                {addAction.label}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
