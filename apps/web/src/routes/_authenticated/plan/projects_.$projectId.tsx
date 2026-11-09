import { createFileRoute } from '@tanstack/react-router';
import { projectPageSearchSchema } from '@/features/projects/lib/project-page-search';
import { ProjectScreen } from '@/features/projects/screens/project';

/**
 * A project's page under Plan's Projects: its milestones, what waits on a
 * person and what is in progress, and its settings; `?view=stats` shows its
 * statistics over `?from=&to=` (the last eight weeks by default).
 */
export const Route = createFileRoute('/_authenticated/plan/projects_/$projectId')({
  validateSearch: projectPageSearchSchema,
  component: ProjectRoute,
});

function ProjectRoute() {
  const { projectId } = Route.useParams();
  return <ProjectScreen projectId={projectId} />;
}
