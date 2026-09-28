import { RouteError } from '@oppenheimer/frontend-web';
import { createFileRoute } from '@tanstack/react-router';
import { AutomationsOverviewScreen } from '@/features/automations/screens/automations-overview';

/** The overview on its Automations tab: the run history and the table. */
export const Route = createFileRoute('/_authenticated/automations/')({
  // Its own boundary, so a thrown render replaces this pane and not the
  // shell around it: without one the error climbs to `_authenticated`.
  errorComponent: RouteError,
  component: AutomationsOverviewScreen,
});
