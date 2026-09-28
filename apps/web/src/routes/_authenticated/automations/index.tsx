import { createFileRoute } from '@tanstack/react-router';
import { AutomationsOverviewScreen } from '@/features/automations/screens/automations-overview';

/** The overview on its Automations tab: the run history and the table. */
export const Route = createFileRoute('/_authenticated/automations/')({
  component: AutomationsOverviewScreen,
});
