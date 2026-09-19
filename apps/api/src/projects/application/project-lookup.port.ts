import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { ProjectEntity } from '../domain/project.entity';

/** The repository a project is created from, as GitHub describes it. */
export interface ProjectOrigin {
  /** GitHub's own repository id — the stable half. */
  githubRepoId: number;
  /** `owner/repo` or `repo`, as GitHub reports it now. Only the name is used. */
  repositoryName: string;
}

/**
 * How another module gets at the project a repository belongs to.
 *
 * This is the module's published surface for the auto-creation rule: a session
 * created for a repository that has no project yet gets one, named after the
 * repository, without the console ever showing a project picker. It is a port
 * rather than a command because the caller needs the id back in the middle of
 * its own work, and a bus round-trip for a lookup would only hide that.
 */
export interface ProjectLookupPort {
  /**
   * The id of the project for this repository, creating it if it has none.
   *
   * Safe to call concurrently: two first sessions on the same repository resolve
   * to the same project.
   */
  ensureForRepository(scope: AccessScope, origin: ProjectOrigin): Promise<string>;
  /** The project a repository already has, if any. Creates nothing. */
  findForRepository(scope: AccessScope, githubRepoId: number): Promise<Option<ProjectEntity>>;
}
