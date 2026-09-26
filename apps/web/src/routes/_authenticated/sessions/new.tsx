import { createFileRoute } from '@tanstack/react-router';
import { NewSessionScreen } from '@/features/sessions/screens/new-session';

/**
 * New session. `full`, like the rest of `/sessions`: the composer is the
 * console's main pane in the artboards, not a page inside it.
 *
 * `?project=` names a project to start on — New project sends the reader back
 * here with the one it just made. Unknown keys pass through, so nuqs keeps
 * whatever it wrote.
 */
export const Route = createFileRoute('/_authenticated/sessions/new')({
  validateSearch: (search: Record<string, unknown>): { project?: string } => ({
    ...search,
    project: typeof search.project === 'string' ? search.project : undefined,
  }),
  component: NewSessionScreen,
  staticData: { pane: 'full' },
});
