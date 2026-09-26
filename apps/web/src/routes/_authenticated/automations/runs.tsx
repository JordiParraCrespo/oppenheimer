import { createFileRoute } from '@tanstack/react-router';
import { RunsScreen } from '@/features/routines/screens/runs';

/** The overview on its Runs tab: every run across the workspace's automations. */
export const Route = createFileRoute('/_authenticated/automations/runs')({
  component: RunsScreen,
});
