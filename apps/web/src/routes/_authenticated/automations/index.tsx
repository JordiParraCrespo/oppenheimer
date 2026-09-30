import { createFileRoute } from '@tanstack/react-router';
import { AutomationsOverviewScreen } from '@/features/automations/screens/automations-overview';

export const Route = createFileRoute('/_authenticated/automations/')({
  component: AutomationsOverviewScreen,
});
