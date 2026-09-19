import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { ProjectEntity } from '../domain/project.entity';

/**
 * The repository a project is created from, as GitHub describes it.
 *
 * Owner and name are separate because the directory-name rules need them apart:
 * the first candidate is the repository's name and the second is
 * `<owner>--<repo>`. `githubRepoId` is a **string**, the form the driver
 * exchanges a bigint as; a caller holding GitHub's number converts at the call
 * (`String(githubRepoId)`) rather than making the identity of a row depend on
 * `MAX_SAFE_INTEGER`.
 */
export interface ProjectOrigin {
  githubRepoId: string;
  owner: string;
  name: string;
}

/**
 * How another module gets at the project a repository belongs to.
 *
 * This is the module's published surface for the auto-creation rule: a session
 * created for a repository that has no project yet gets one, named after the
 * repository, without the console ever showing a project picker. It is a port
 * rather than a command because the caller needs the project back in the middle
 * of its own work, and a bus round-trip for a lookup would only hide that.
 *
 * The **project** comes back, not its id: the caller is about to put work inside
 * the project's directory, so it has to be able to see the state of the project
 * it was handed — which is what will matter the moment archiving exists.
 */
export interface ProjectLookupPort {
  /**
   * The project for this repository, creating it if it has none.
   *
   * Safe to call concurrently: two first sessions on the same repository resolve
   * to the same project.
   */
  ensureForRepository(scope: AccessScope, origin: ProjectOrigin): Promise<ProjectEntity>;
  /** The project a repository already has, if any. Creates nothing. */
  findForRepository(scope: AccessScope, githubRepoId: string): Promise<Option<ProjectEntity>>;
}
