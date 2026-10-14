import { RunsList, Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { OverviewTop } from '../sections/overview-top';
import { RunHistoryCard } from '../sections/run-history-card';
import { RunsTable } from '../sections/runs-table';

/** The overview on its Runs tab: the tabs, the run history with its legend, every run. */
export function RunsOverviewScreen() {
  const { t } = useTranslation();
  return (
    <>
      <OverviewTop />
      <RunHistoryCard />
      <QueryState>
        <QueryState.Pending>
          <RunsList>
            <div className="flex flex-col gap-1 p-1.5">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          </RunsList>
        </QueryState.Pending>
        <QueryState.Error fallback={t('automations.runs.loadFailed')} />
        <QueryState.Data>
          <RunsTable />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
