import { RoutineTable, Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AutomationsTable } from '../sections/automations-table';
import { OverviewTop } from '../sections/overview-top';
import { RunHistoryCard } from '../sections/run-history-card';

/**
 * The overview on its Automations tab: the tabs, the run history (whose
 * header links to the Runs tab) and the table, which reads the automations
 * under Suspense.
 */
export function AutomationsOverviewScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <>
      <OverviewTop />
      <QueryState>
        <QueryState.Pending>
          <Skeleton shape="lg" className="h-47.5 w-full" />
        </QueryState.Pending>
        <QueryState.Error fallback={t('automations.history.loadFailed')} />
        <QueryState.Data>
          <RunHistoryCard onOpenRuns={() => navigate({ to: '/automations/runs' })} />
        </QueryState.Data>
      </QueryState>
      <QueryState>
        <QueryState.Pending>
          <RoutineTable>
            <div className="flex flex-col gap-1.5 p-1.5">
              <Skeleton className="h-13.5 w-full" />
              <Skeleton className="h-13.5 w-full" />
            </div>
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
