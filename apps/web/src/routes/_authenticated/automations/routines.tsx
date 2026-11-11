import { createFileRoute } from '@tanstack/react-router';
import { RoutinesOverviewScreen } from '@/features/automations/screens/routines-overview';

export const Route = createFileRoute('/_authenticated/automations/routines')({
  component: RoutinesOverviewScreen,
});
