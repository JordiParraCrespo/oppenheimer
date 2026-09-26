import { createFileRoute } from '@tanstack/react-router';
import { AutomationEditorScreen } from '@/features/routines/screens/automation-editor';

/** Edit automation: the same editor as New automation, on an existing one. */
export const Route = createFileRoute('/_authenticated/_editor/automations/$automationId/edit')({
  component: EditAutomationRoute,
  staticData: { list: 'automations' },
});

function EditAutomationRoute() {
  const { automationId } = Route.useParams();
  return <AutomationEditorScreen automationId={automationId} />;
}
