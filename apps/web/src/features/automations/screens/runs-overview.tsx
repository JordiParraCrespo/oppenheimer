import { OverviewTop } from '../sections/overview-top';
import { RunHistoryCard } from '../sections/run-history-card';
import { RunsTable } from '../sections/runs-table';

/** The overview on its Runs tab: the tabs, the run history with its legend, every run. */
export function RunsOverviewScreen() {
  return (
    <>
      <OverviewTop />
      <RunHistoryCard />
      <RunsTable />
    </>
  );
}
