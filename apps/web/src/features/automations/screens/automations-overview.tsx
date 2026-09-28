import { useNavigate } from '@tanstack/react-router';
import { AutomationsTable } from '../sections/automations-table';
import { OverviewTop } from '../sections/overview-top';
import { RunHistoryCard } from '../sections/run-history-card';

/**
 * The overview on its Automations tab: the tabs, the run history (whose
 * header links to the Runs tab) and the table.
 */
export function AutomationsOverviewScreen() {
  const navigate = useNavigate();
  return (
    <>
      <OverviewTop />
      <RunHistoryCard onOpenRuns={() => navigate({ to: '/automations/runs' })} />
      <AutomationsTable />
    </>
  );
}
