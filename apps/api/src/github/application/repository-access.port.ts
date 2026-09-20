import type { AccessScope } from '@oppenheimer/backend-authz';
import type { GithubRepository } from '../infrastructure/github-app.port';

/**
 * What `sessions/` and `relay/` inject to exercise a workspace's GitHub access.
 *
 * It is the one door out of this module for that purpose: a caller names a
 * connected installation and one repository, and gets either a credential for
 * exactly that repository or what GitHub currently calls it. There is nothing to
 * ask for "the repositories I may use", because the installation is the access
 * control and GitHub answers it (`product/versions/mvp/03-control-plane.md`).
 */
export interface RepositoryToken {
  /** The installation access token. Never logged, never stored in a row. */
  token: string;
  /** GitHub's own expiry, one hour out. */
  expiresAt: Date;
  /** The repository the token is narrowed to, echoed back for the caller's log. */
  githubRepoId: number;
}

export interface RepositoryAccessPort {
  /**
   * One repository of one connected installation, as GitHub describes it right
   * now: its name, its full name and its default branch.
   *
   * This one **does** take an access scope, because it answers a person's request
   * — naming the checkout a session is about to take — rather than running for a
   * host. The installation is read under that scope, so a checkout through another
   * workspace's installation is refused here as well as being unrepresentable in
   * the schema, and whether the installation covers the repository is GitHub's to
   * say: its 404 is `GITHUB_010`.
   */
  repositoryOf(
    scope: AccessScope,
    installationId: string,
    githubRepoId: number,
  ): Promise<GithubRepository>;
  /**
   * Mint a token for one repository of one connected installation.
   *
   * `installationId` is the **control-plane row's uuid**, not GitHub's number:
   * it is what a checkout records, and the caller is expected to have read that
   * checkout under its own tenant scope. There is no access scope here because a
   * mint runs for a host rather than for a request — the returned installation
   * is the workspace's by construction, and `sessions/` asserts the match
   * against the session it is minting for.
   *
   * Every call is a live mint. Nothing caches the token and nothing stores it:
   * GitHub gives it an hour, the runner holds it for that hour, and the platform
   * keeps no GitHub credential beyond the scoped tokens it mints. That is also
   * what makes the guarantee true — a repository removed from the installation
   * stops working on the next mint rather than at the end of a cache TTL.
   */
  mintRepositoryToken(installationId: string, githubRepoId: number): Promise<RepositoryToken>;
}
