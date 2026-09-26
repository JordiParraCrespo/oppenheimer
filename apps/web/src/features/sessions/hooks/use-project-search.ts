import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useEffect, useRef } from 'react';

/**
 * Apply `/sessions/new?project=` once the project list can answer it.
 *
 * The external system is the URL: the sidebar's "New session here" names a
 * project in the address, and the composer has to start on it with its
 * defaults prefilled, which needs the entity and not just the id — and the
 * host list, since a default host the list has not answered for yet would
 * be skipped as if it were gone. The pick runs once per address — a project the reader then changes by hand stays
 * changed, and an id the list does not hold is ignored rather than written.
 */
export function useProjectSearch(
  projectId: string | undefined,
  projects: readonly ProjectEntity[] | undefined,
  /** Whether the lists the pick reads (the hosts) have settled; the pick waits for them. */
  ready: boolean,
  pick: (project: ProjectEntity) => void,
) {
  const applied = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId || !projects || !ready || applied.current === projectId) return;
    const project = projects.find((candidate) => candidate.id === projectId);
    if (!project) return;
    applied.current = projectId;
    pick(project);
  }, [projectId, projects, ready, pick]);
}
