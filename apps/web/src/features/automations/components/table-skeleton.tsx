import {
  RoutineTable,
  RoutineTableHead,
  RoutineTableRowSkeleton,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { STATUS_TABS, type StatusTab } from '../lib/list-filters';
import { FilterRow } from './filter-row';

/**
 * The Automations or Bot routines tab's place while its list has not
 * answered, in the table's own card: the status tabs written with their
 * counts as bars, the owner and Trigger facets at their size, the real column
 * heads and two rows, so the table that replaces it grows by its rows and
 * nothing else moves.
 */
export function TableSkeleton({
  status,
  columns,
}: {
  status: StatusTab;
  columns: [string, string, string, string];
}) {
  const { t } = useTranslation();
  return (
    <RoutineTable aria-busy>
      <LoadingStatus />
      <FilterRow
        tabs={STATUS_TABS}
        value={status}
        label={(tab) => t(`automations.filter.${tab}`)}
        count={() => <Skeleton shape="sm" className="h-2 w-3" />}
        disabled
      >
        <Skeleton shape="pill" className="h-7 w-20" />
        <Skeleton shape="pill" className="h-7 w-24" />
      </FilterRow>
      <RoutineTableHead aria-hidden columns={columns} />
      <RoutineTableRowSkeleton index={0} />
      <RoutineTableRowSkeleton index={1} />
    </RoutineTable>
  );
}
