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
  /** Our `github_installation` row the repository was reached through. */
  installationId: string;
  /** `owner/repo` as GitHub spells it now. */
  fullName: string;
  /** The repository's default branch: the base the project offers for it. */
  defaultBranch: string;
}

/**
 * How another module gets at the project a session belongs to.
 *
 * The console always names the project. Auto-creation is the fallback for a
 * caller that names only a repository (an API token, an MCP client): that session
 * gets the project the API made for the repository, holding that one repository
 * as its default (`product/versions/mvp/12-projects.md`). It is a port
 * rather than a command because the caller needs the project back in the middle
 * of its own work, and a bus round-trip for a lookup would only hide that.
 *
 * The **project** comes back, not its id: the caller is about to put work inside
 * the project's directory, so it has to be able to see the state of the project
 * it was handed — which is what will matter the moment archiving exists.
 */
export interface ProjectLookupPort {
  /**
   * The project the API made for this repository, creating it if there is none.
   * Never "a project that happens to contain it": a repository can be in many, and
   * that answer would change when somebody edited an unrelated project.
   *
   * Safe to call concurrently: two first sessions on the same repository resolve
   * to the same project.
   */
  ensureForRepository(scope: AccessScope, origin: ProjectOrigin): Promise<ProjectEntity>;
  /** The project a repository already has, if any. Creates nothing. */
  findForRepository(scope: AccessScope, githubRepoId: string): Promise<Option<ProjectEntity>>;
  /**
   * The project a caller named outright, for the case where a session says which
   * project it belongs in rather than bringing a repository to derive one from — a
   * session with no checkouts at all has nothing to derive from.
   *
   * `None` for a project that is missing, archived or in another workspace: a
   * retired project's directory is out of use, and its slug is a path segment on
   * every host that holds it.
   */
  findOneById(scope: AccessScope, projectId: string): Promise<Option<ProjectEntity>>;
  /**
   * A session's **home** project, archived or not: the directory its tree is in.
   *
   * A session moved out of a project keeps its tree in that project's directory,
   * and that project may since have been archived — it held no session listed in
   * it any more. Its slug is still the path segment every runner command names,
   * so this read does not hide it. `None` only for a project the caller cannot see.
   */
  findHomeOf(scope: AccessScope, projectId: string): Promise<Option<ProjectEntity>>;
}
