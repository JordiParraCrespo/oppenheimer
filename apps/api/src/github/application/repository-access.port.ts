/**
 * What `sessions/` and `relay/` inject to exercise a workspace's GitHub access.
 *
 * It is the one door out of this module for that purpose, and it is deliberately
 * one method: a caller names a connected installation and one repository, and
 * gets a credential for exactly that repository. There is nothing to ask for
 * "the repositories I may use" because the installation is the allowlist and
 * GitHub answers it (`product/09-github-app-install.md`).
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
   * Mint a token for one repository of one connected installation.
   *
   * `installationId` is the **control-plane row's uuid**, not GitHub's number:
   * it is what a checkout records, and the caller is expected to have read that
   * checkout under its own tenant scope. There is no access scope here because a
   * mint runs for a host rather than for a request — the returned installation
   * is the workspace's by construction, and `sessions/` asserts the match
   * against the session it is minting for.
   *
   * Tokens are cached until shortly before they expire, so a session that
   * reconnects does not spend a GitHub call, and are never rows: nothing about
   * them is revocable in the hour they live.
   */
  mintRepositoryToken(installationId: string, githubRepoId: number): Promise<RepositoryToken>;
}
