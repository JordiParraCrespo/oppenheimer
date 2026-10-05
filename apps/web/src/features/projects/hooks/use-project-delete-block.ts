import { useSessions } from '@oppenheimer/frontend-consumer/react';

/**
 * Whether Delete project is off for a project, and how many sessions hold it.
 * The API refuses to delete a project with an open session (`PROJECTS_005`)
 * and when nothing can say (`PROJECTS_003`), so until the list arrives the
 * answer is blocked, not clear. The list already leaves resolved sessions out.
 */
export function useProjectDeleteBlock(projectId: string): {
  blocked: boolean;
  openSessions: number | undefined;
} {
  const { data: openSessions } = useSessions({
    select: (sessions) => sessions.filter((row) => row.projectId === projectId).length,
  });
  return { blocked: openSessions !== 0, openSessions };
}
