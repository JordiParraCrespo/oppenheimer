import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { ProjectEntity } from '../domain/project.entity';

/**
 * How another module gets at a project it was told about.
 *
 * A session is listed under the project it names, or under the workspace's
 * Unassigned project when it names none. Nothing derives a project from a
 * repository. The **project** comes back, not its id: the caller is about to
 * list work under it, and needs to see its state.
 */
export interface ProjectLookupPort {
  /**
   * The project a caller named. `None` for a project that is missing, archived or
   * in another workspace: nothing new is listed under a retired project.
   */
  findOneById(scope: AccessScope, projectId: string): Promise<Option<ProjectEntity>>;
  /**
   * The workspace's Unassigned project, provisioned on the way if the workspace
   * has none yet (the event that provisions it has not been delivered).
   */
  unassigned(scope: AccessScope): Promise<ProjectEntity>;
}
