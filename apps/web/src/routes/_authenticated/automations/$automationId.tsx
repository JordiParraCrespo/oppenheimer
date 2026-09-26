import { createFileRoute } from '@tanstack/react-router';
import { AutomationScreen } from '@/features/routines/screens/automation';

/** One automation: its header, its run history and its runs. */
export const Route = createFileRoute('/_authenticated/automations/$automationId')({
  component: AutomationRoute,
});

function AutomationRoute() {
  const { automationId } = Route.useParams();
  return <AutomationScreen automationId={automationId} />;
}
