import {
  PillTab,
  PillTabs,
  RoutineTable,
  RoutineTableHead,
  RoutineTableRowSkeleton,
  RunsListFilters,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { botRoutineColumns } from '../lib/automation-view';
import { ROUTINE_STATUS_TABS, type RoutineStatusTab } from '../lib/routines-search';

/**
 * The Bot routines tab's place while the routines have not answered, in the
 * table's own card: the status tabs written with their counts as bars, the
 * Bot and Trigger facets at their size, the real column heads and two rows,
 * so the table that replaces it grows by its rows and nothing else moves.
 */
export function RoutinesSkeleton({ status }: { status: RoutineStatusTab }) {
  const { t } = useTranslation();
  return (
    <RoutineTable aria-busy>
      <LoadingStatus />
      <RunsListFilters>
        <PillTabs size="sm" value={status} onValueChange={() => {}} disabled>
          {ROUTINE_STATUS_TABS.map((tab) => (
            <PillTab key={tab} value={tab} count={<Skeleton shape="sm" className="h-2 w-3" />}>
              {t(`automations.routines.filter.${tab}`)}
            </PillTab>
          ))}
        </PillTabs>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          <Skeleton shape="pill" className="h-7 w-20" />
          <Skeleton shape="pill" className="h-7 w-24" />
        </div>
      </RunsListFilters>
      <RoutineTableHead aria-hidden columns={botRoutineColumns(t)} />
      <RoutineTableRowSkeleton index={0} />
      <RoutineTableRowSkeleton index={1} />
    </RoutineTable>
  );
}
