import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { RunHistorySkeleton } from '../components/run-history-skeleton';
import { RunsSkeleton } from '../components/runs-skeleton';
import { OverviewTop } from '../sections/overview-top';
import { RunHistoryCard } from '../sections/run-history-card';
import { RunsTable } from '../sections/runs-table';

/** The overview on its Runs tab: the tabs, the run history with its legend, every run. */
export function RunsOverviewScreen() {
  const { t } = useTranslation();
  return (
    <>
      <OverviewTop />
      <QueryState>
        <QueryState.Pending>
          <RunHistorySkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('automations.history.loadFailed')} />
        <QueryState.Data>
          <RunHistoryCard />
        </QueryState.Data>
      </QueryState>
      <QueryState>
        <QueryState.Pending>
          <RunsSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('automations.runs.loadFailed')} />
        <QueryState.Data>
          <RunsTable />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
