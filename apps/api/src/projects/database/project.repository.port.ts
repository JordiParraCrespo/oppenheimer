import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { ProjectEntity } from '../domain/project.entity';

export type ProjectInsertOutcome = 'inserted' | 'origin-taken' | 'slug-taken';

export type ArchiveOutcome =
  | { result: 'archived' | 'in-use'; project: ProjectEntity }
  | { result: 'not-found' };

export interface ProjectRepositoryPort {
  /**
   * Insert the aggregate with its repository rows, in one transaction. The
   * outcome names which unique constraint refused it, so the caller can tell
   * "somebody else made this repository's project" from "that directory name
   * belongs to another repository".
   */
  insertIfUnclaimed(entity: ProjectEntity): Promise<ProjectInsertOutcome>;
  /**
   * Write the name, the defaults and the repository set of an **active**
   * project, in one transaction, and return the stored aggregate — or `None`
   * when the row is out of scope or was retired meanwhile, so no write can
   * revive a tombstone.
   */
  saveIfActive(scope: AccessScope, entity: ProjectEntity): Promise<Option<ProjectEntity>>;
  archiveIfUnused(
    scope: AccessScope,
    projectId: string,
    stillInUse: () => Promise<boolean>,
  ): Promise<ArchiveOutcome>;
  findAll(scope: AccessScope, options?: { includeArchived?: boolean }): Promise<ProjectEntity[]>;
  findOneById(scope: AccessScope, id: string): Promise<Option<ProjectEntity>>;
  findOneByOrigin(scope: AccessScope, githubRepoId: string): Promise<Option<ProjectEntity>>;
}
