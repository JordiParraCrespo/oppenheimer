import { createFileRoute } from '@tanstack/react-router';
import { AutomationEditorScreen } from '@/features/automations/screens/automation-editor';

/**
 * New automation: the editor over the main column, behind the sidebar's New
 * automation and a project header's plus. `?project=` is where the plus
 * opened it from; the route keeps it for the Where step, which arrives with
 * the API. The frame around it is `_editor.tsx`'s, and the list beside the
 * rail is the address's.
 */
export const Route = createFileRoute('/_authenticated/_editor/automations/new')({
  component: AutomationEditorScreen,
  validateSearch: (search: Record<string, unknown>): { project?: string } => ({
    ...search,
    project: typeof search.project === 'string' ? search.project : undefined,
  }),
});
