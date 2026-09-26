import { createFileRoute } from '@tanstack/react-router';
import { NewProjectScreen } from '@/features/projects/screens/new-project';

/**
 * New project. `full`, like New session: the export draws it as a page in the
 * console's main pane, with the sidebar beside it, not a dialog over it.
 */
export const Route = createFileRoute('/_authenticated/projects/new')({
  component: NewProjectScreen,
  staticData: { pane: 'full' },
});
