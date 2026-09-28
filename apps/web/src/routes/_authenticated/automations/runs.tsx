import { RouteError } from '@oppenheimer/frontend-web';
import { createFileRoute } from '@tanstack/react-router';
import { RunsOverviewScreen } from '@/features/automations/screens/runs-overview';

/** The overview on its Runs tab: every run across the workspace's automations. */
export const Route = createFileRoute('/_authenticated/automations/runs')({
  // Its own boundary, so a thrown render replaces this pane and not the
  // shell around it: without one the error climbs to `_authenticated`.
  errorComponent: RouteError,
  component: RunsOverviewScreen,
});
