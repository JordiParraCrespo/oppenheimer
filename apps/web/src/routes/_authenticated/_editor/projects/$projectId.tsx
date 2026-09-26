import { createFileRoute } from '@tanstack/react-router';
import { ProjectScreen } from '@/features/projects/screens/project';

/**
 * Project settings: the same page as New project, editing, behind a project
 * header's cog in the sidebar (`product/versions/mvp/05-screens.md`).
 */
export const Route = createFileRoute('/_authenticated/_editor/projects/$projectId')({
  component: ProjectRoute,
});

function ProjectRoute() {
  const { projectId } = Route.useParams();
  return <ProjectScreen projectId={projectId} />;
}
