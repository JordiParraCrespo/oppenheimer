import { createFileRoute } from '@tanstack/react-router';
import { automationsSearchSchema } from '@/features/automations/lib/automations-search';
import { AutomationsOverviewScreen } from '@/features/automations/screens/automations-overview';

export const Route = createFileRoute('/_authenticated/automations/')({
  validateSearch: automationsSearchSchema,
  component: AutomationsOverviewScreen,
});
