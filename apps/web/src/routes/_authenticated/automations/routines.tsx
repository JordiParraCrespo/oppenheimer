import { createFileRoute } from '@tanstack/react-router';
import { routinesSearchSchema } from '@/features/automations/lib/routines-search';
import { RoutinesOverviewScreen } from '@/features/automations/screens/routines-overview';

export const Route = createFileRoute('/_authenticated/automations/routines')({
  validateSearch: routinesSearchSchema,
  component: RoutinesOverviewScreen,
});
