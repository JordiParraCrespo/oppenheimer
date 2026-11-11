import {
  RoutineTable,
  RoutineTableHead,
  RoutineTableRowSkeleton,
} from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { RunHistorySkeleton } from '../components/run-history-skeleton';
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
          <RoutineTable aria-busy>
            <RoutineTableHead
              aria-hidden
              columns={[
                t('automations.table.automation'),
                t('automations.table.trigger'),
                t('automations.table.next'),
                t('automations.table.status'),
              ]}
            />
            <RoutineTableRowSkeleton index={0} />
            <RoutineTableRowSkeleton index={1} />
          </RoutineTable>
        </QueryState.Pending>
        <QueryState.Error fallback={t('automations.page.loadFailed')} />
        <QueryState.Data>
          <AutomationsTable />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
