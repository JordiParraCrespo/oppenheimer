import { createFileRoute } from '@tanstack/react-router';
import { ProjectScreen } from '@/features/projects/screens/project';

/**
 * New project: the page over the main column behind the project chip's foot
 * row and the sidebar's plus (`product/versions/mvp/12-projects-on-the-console.md`).
 * `full`, because the page scrolls its own column, as the console's panes do.
 */
export const Route = createFileRoute('/_authenticated/projects/new')({
  component: ProjectScreen,
  staticData: { pane: 'full' },
});
