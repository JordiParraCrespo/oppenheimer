import { createFileRoute } from '@tanstack/react-router';
import { ProjectsScreen } from '@/features/projects/screens/projects';

/**
 * Plan's Projects: the workspace's projects, made and edited here rather
 * than from the Sessions sidebar.
 */
export const Route = createFileRoute('/_authenticated/plan/projects')({
  component: ProjectsScreen,
});
