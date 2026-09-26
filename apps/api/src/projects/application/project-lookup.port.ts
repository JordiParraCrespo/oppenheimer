import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { ProjectEntity } from '../domain/project.entity';

/**
 * How another module gets at a project it was told about.
 *
 * A session always names its project; nothing creates one on the side, so this
 * port only reads. The **project** comes back, not its id: the caller is about to
 * list work under it, and needs to see its state.
 */
export interface ProjectLookupPort {
  /**
   * The project a caller named. `None` for a project that is missing, archived or
   * in another workspace: nothing new is listed under a retired project.
   */
  findOneById(scope: AccessScope, projectId: string): Promise<Option<ProjectEntity>>;
}
