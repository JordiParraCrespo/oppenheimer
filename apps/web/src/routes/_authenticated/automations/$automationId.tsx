import { createFileRoute } from '@tanstack/react-router';
import { runsSearchSchema } from '@/features/automations/lib/runs-search';
import { AutomationScreen } from '@/features/automations/screens/automation';

/** An automation's page: its header, run history and runs. */
export const Route = createFileRoute('/_authenticated/automations/$automationId')({
  validateSearch: runsSearchSchema,
  component: AutomationRoute,
});

function AutomationRoute() {
  const { automationId } = Route.useParams();
  // Keyed, so moving between two automations starts the page afresh.
  return <AutomationScreen key={automationId} automationId={automationId} />;
}
