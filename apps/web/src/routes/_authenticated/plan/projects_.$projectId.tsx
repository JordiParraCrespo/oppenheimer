import { createFileRoute } from '@tanstack/react-router';
import { ProjectScreen } from '@/features/projects/screens/project';

/**
 * A project's page under Plan's Projects: its milestones, what waits on a
 * person and what is in progress, and its settings.
 */
export const Route = createFileRoute('/_authenticated/plan/projects_/$projectId')({
  component: ProjectRoute,
});

function ProjectRoute() {
  const { projectId } = Route.useParams();
  return <ProjectScreen projectId={projectId} />;
}
