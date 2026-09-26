import { createFileRoute } from '@tanstack/react-router';
import { ProjectScreen } from '@/features/projects/screens/project';

/**
 * New project: the page over the main column behind the project chip's foot
 * row and the sidebar's plus (`product/versions/mvp/05-screens.md`).
 * The frame around it is `_editor.tsx`'s.
 */
export const Route = createFileRoute('/_authenticated/_editor/projects/new')({
  component: ProjectScreen,
});
