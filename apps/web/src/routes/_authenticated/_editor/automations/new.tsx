import { createFileRoute } from '@tanstack/react-router';
import { AutomationEditorScreen } from '@/features/routines/screens/automation-editor';

/**
 * New automation: the editor over the main column, behind the sidebar's New
 * automation and a project header's plus (`?project=`, which the editor
 * starts on). The frame around it is `_editor.tsx`'s.
 */
export const Route = createFileRoute('/_authenticated/_editor/automations/new')({
  component: NewAutomationRoute,
  // Under `_editor`, not `/automations`, so the list the sidebar shows is said here.
  staticData: { list: 'automations' },
  validateSearch: (search: Record<string, unknown>): { project?: string } => ({
    ...search,
    project: typeof search.project === 'string' ? search.project : undefined,
  }),
});

function NewAutomationRoute() {
  const { project } = Route.useSearch();
  return <AutomationEditorScreen projectId={project} />;
}
