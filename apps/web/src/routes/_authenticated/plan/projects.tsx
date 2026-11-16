import { createFileRoute } from '@tanstack/react-router';
import { projectsSearchSchema } from '@/features/projects/lib/projects-search';
import { ProjectsScreen } from '@/features/projects/screens/projects';

/**
 * Plan's Projects: the workspace's projects, made and edited here rather
 * than from the Sessions sidebar. `?q=` narrows the cards.
 */
export const Route = createFileRoute('/_authenticated/plan/projects')({
  validateSearch: projectsSearchSchema,
  component: ProjectsScreen,
});
