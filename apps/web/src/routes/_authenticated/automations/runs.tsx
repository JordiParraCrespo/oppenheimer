import { createFileRoute } from '@tanstack/react-router';
import { runsSearchSchema } from '@/features/automations/lib/runs-search';
import { RunsOverviewScreen } from '@/features/automations/screens/runs-overview';

/** The overview on its Runs tab: every run across the workspace's automations. */
export const Route = createFileRoute('/_authenticated/automations/runs')({
  validateSearch: runsSearchSchema,
  component: RunsOverviewScreen,
});
