import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { TableSkeleton } from '../components/table-skeleton';
import { useRoutinesFilters } from '../hooks/use-routines-filters';
import { botRoutineColumns } from '../lib/automation-view';
import { BotRoutinesTable } from '../sections/bot-routines-table';
import { OverviewTop } from '../sections/overview-top';

/** The overview on its Bot routines tab: the tabs and every bot's routines. */
export function RoutinesOverviewScreen() {
  const { t } = useTranslation();
  const { state } = useRoutinesFilters();
  return (
    <>
      <OverviewTop />
      <QueryState>
        <QueryState.Pending>
          <TableSkeleton status={state.status} columns={botRoutineColumns(t)} />
        </QueryState.Pending>
        <QueryState.Error fallback={t('automations.routines.loadFailed')} />
        <QueryState.Data>
          <BotRoutinesTable />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
