import type { AccessScope } from '@oppenheimer/backend-authz';
import type { GithubRepository } from '../infrastructure/github-app.port';

export interface RepositoryToken {
  /** The installation access token. Never logged, never stored in a row. */
  token: string;
  /** GitHub's own expiry, one hour out. */
  expiresAt: Date;
  /** The repository the token is narrowed to, echoed back for the caller's log. */
  githubRepoId: number;
}

/**
 * What `sessions/`, `automations/`, `projects/` and `relay/` inject to exercise
 * a workspace's GitHub access.
 *
 * It is the one door out of this module for that purpose: a caller names a
 * connected installation and one repository, and gets either a credential for
 * exactly that repository or what GitHub currently calls it. There is nothing to
 * ask for "the repositories I may use", because the installation is the access
 * control and GitHub answers it (`product/versions/mvp/03-control-plane.md`).
 */
export interface RepositoryAccessPort {
  /**
   * One repository of one connected installation, as GitHub describes it now:
   * name, full name and default branch.
   *
   * Takes an access scope because it answers a person's request, not a host's:
   * a checkout through another workspace's installation is refused here as
   * well as unrepresentable in the schema. Whether the installation covers the
   * repository is GitHub's to say; its 404 is `GITHUB_010`.
   */
  repositoryOf(
    scope: AccessScope,
    installationId: string,
    githubRepoId: number,
  ): Promise<GithubRepository>;
  /**
   * `installationId` is the **control-plane row's uuid**, not GitHub's number:
   * what a checkout records, read by the caller under its own tenant scope. No
   * access scope, because a mint runs for a host; the relay takes the
   * installation from the live checkout it mints for.
   *
   * Every call is a live mint, never cached or stored: GitHub gives the token
   * an hour and the runner holds it for that hour. So a repository removed from
   * the installation stops working on the next mint, not at a cache TTL.
   */
  mintRepositoryToken(installationId: string, githubRepoId: number): Promise<RepositoryToken>;
}
