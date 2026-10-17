import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useSuspenseProjects } from '@oppenheimer/frontend-consumer/react';
import type { ReactNode } from 'react';

/**
 * The project Project settings edits, in `ProjectDialog`'s `QueryState.Data`:
 * read under Suspense and handed to `children`, `null` when it is gone. The
 * dialog composes the editor or the "gone" frame from it.
 */
export function SavedProject({
  projectId,
  children,
}: {
  projectId: string;
  children: (project: ProjectEntity | null) => ReactNode;
}) {
  // A refetch that fails is not drawn here: the editor's form was seeded once.
  const { data: project } = useSuspenseProjects(
    (rows) => rows.find((row) => row.id === projectId) ?? null,
  );
  return children(project);
}
