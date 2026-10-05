import { createFileRoute } from '@tanstack/react-router';
import { runsSearchSchema } from '@/features/automations/lib/runs-search';
import { RunsOverviewScreen } from '@/features/automations/screens/runs-overview';

export const Route = createFileRoute('/_authenticated/automations/runs')({
  validateSearch: runsSearchSchema,
  component: RunsOverviewScreen,
});
