import { QueryState } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { RunHistorySkeleton } from '../components/run-history-skeleton';
import { TableSkeleton } from '../components/table-skeleton';
import { useListFilters } from '../hooks/use-list-filters';
import { automationColumns } from '../lib/automation-view';
import { AutomationsTable } from '../sections/automations-table';
import { OverviewTop } from '../sections/overview-top';
import { RunHistoryCard } from '../sections/run-history-card';

/**
 * The overview on its Automations tab: the tabs, the run history (whose
 * header links to the Runs tab), the table, which reads the automations
 * under Suspense. The bots' routines are their own tab.
 */
export function AutomationsOverviewScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useListFilters('automations');
  return (
    <>
      <OverviewTop />
      <QueryState>
        <QueryState.Pending>
          <RunHistorySkeleton link />
        </QueryState.Pending>
        <QueryState.Error fallback={t('automations.history.loadFailed')} />
        <QueryState.Data>
          <RunHistoryCard onOpenRuns={() => navigate({ to: '/automations/runs' })} />
        </QueryState.Data>
      </QueryState>
      <QueryState>
        <QueryState.Pending>
          <TableSkeleton status={state.status} columns={automationColumns(t)} />
        </QueryState.Pending>
        <QueryState.Error fallback={t('automations.page.loadFailed')} />
        <QueryState.Data>
          <AutomationsTable />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
