import type { StatusState } from '@oppenheimer/design-system-web';
import {
  type ProjectEntity,
  type SessionEntity,
  shortName,
  type TaskEntity,
} from '@oppenheimer/frontend-consumer';

/** A project card's status: one of its sessions waits on you, one works, or none does. */
export type ProjectStatus = Extract<StatusState, 'needs-input' | 'running' | 'idle'>;

/**
 * What a project card's dot says, from its open sessions: Needs input when
 * any waits on you, Running when any works or lands, Idle otherwise.
 */
export function projectStatusOf(
  projectId: string,
  sessions: readonly Pick<SessionEntity, 'projectId' | 'state'>[],
): ProjectStatus {
  const own = sessions.filter((session) => session.projectId === projectId);
  if (own.some((session) => session.state === 'waiting-on-you')) return 'needs-input';
  if (own.some((session) => session.state === 'working' || session.state === 'landing')) {
    return 'running';
  }
  return 'idle';
}

/** The card's mono line: each repository's own name, `xrp-mobile · atlas`. */
export function projectRepositoriesLine(project: Pick<ProjectEntity, 'repositories'>): string {
  return project.repositories.map((repository) => shortName(repository.fullName)).join(' · ');
}

/**
 * A project's page: the tasks that wait on a person (Needs input), the ones
 * being worked that do not (In progress), each in board order.
 */
export function projectTaskGroups(projectId: string, tasks: readonly TaskEntity[]) {
  const own = tasks.filter((task) => task.projectId === projectId);
  return {
    blocked: own.filter((task) => task.isBlocked),
    doing: own.filter((task) => task.status === 'doing' && !task.isBlocked),
  };
}
