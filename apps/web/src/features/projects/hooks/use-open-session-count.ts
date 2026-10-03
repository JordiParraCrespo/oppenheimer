import { useSessions } from '@oppenheimer/frontend-consumer/react';

/**
 * How many of a project's sessions still hold it: the API refuses to delete a
 * project with an unresolved session (`PROJECTS_005`). Resolved rows stay for
 * ever so the slug is never reissued, and they do not count. A count, so a
 * poll that changes nothing about this project re-renders nothing that reads
 * it.
 */
export function useOpenSessionCount(projectId: string): number {
  const { data } = useSessions({
    select: (sessions) =>
      sessions.filter((row) => row.projectId === projectId && row.lifecycle !== 'resolved').length,
  });
  return data ?? 0;
}
