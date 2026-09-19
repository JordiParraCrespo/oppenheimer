/**
 * What the application needs from the GitHub App, in this module's own
 * vocabulary. No Octokit type crosses this line — the vendor stops at
 * `octokit-github-app.adapter.ts`, which is the only file that imports it.
 */

/** One repository the installation covers, as GitHub answered for it. */
export interface GithubRepository {
  githubRepoId: number;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  archived: boolean;
  /** ISO 8601, not a `Date`: the listing is cached in Redis as JSON, and a
   *  string round-trips losslessly where a `Date` would come back a string
   *  anyway. */
  pushedAt: string | null;
}

/** One branch of one repository. */
export interface GithubBranch {
  name: string;
  commitSha: string;
  protected: boolean;
}

/** An installation the authorizing account can actually see. */
export interface GithubInstallationClaim {
  githubInstallationId: number;
  accountLogin: string;
  accountType: string;
  repositorySelection: 'all' | 'selected';
}

/** A token narrowed to one repository, with the expiry GitHub gave it. */
export interface GithubRepositoryToken {
  token: string;
  expiresAt: Date;
}

export interface GithubAppPort {
  /** Whether the App's credentials are present on this deployment. */
  isConfigured(): boolean;
  /**
   * Exchange the OAuth code from the installation redirect and return the
   * installations that account can see.
   *
   * This is the claim proof, and it has no fallback: matching the installation's
   * `account.login` against the caller's linked GitHub account fails for
   * organization installations, where that login is the org rather than a user
   * (`product/09-github-app-install.md` §1). The code is used once, here, and
   * never stored.
   */
  listUserInstallations(code: string): Promise<GithubInstallationClaim[]>;
  /** Every repository the installation covers, read through its own token. */
  listInstallationRepositories(githubInstallationId: number): Promise<GithubRepository[]>;
  /** One repository's branches, plus which of them is the default. */
  listRepositoryBranches(
    githubInstallationId: number,
    githubRepoId: number,
  ): Promise<{ branches: GithubBranch[]; defaultBranch: string }>;
  /**
   * An installation access token narrowed to one repository, with contents and
   * metadata only, valid for an hour. A live call every time, so it fails the
   * moment the repository leaves the installation.
   */
  mintRepositoryToken(
    githubInstallationId: number,
    githubRepoId: number,
  ): Promise<GithubRepositoryToken>;
}
