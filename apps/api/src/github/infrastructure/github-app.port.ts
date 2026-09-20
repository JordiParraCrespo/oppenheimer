/**
 * What the application needs from the GitHub App, in this module's own
 * vocabulary. Nothing of GitHub's wire shape crosses this line — the vendor
 * stops at `github-rest.adapter.ts`, the only file that talks to it.
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

/** One installation the authorizing account can see. Visibility, nothing more. */
export interface GithubInstallationRef {
  githubInstallationId: number;
}

/** GitHub's own current answer about one installation. */
export interface GithubInstallationClaim {
  githubInstallationId: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
  repositorySelection: 'all' | 'selected';
  /** Suspended on GitHub right now, or null. Never assumed. */
  suspendedAt: Date | null;
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
   * Exchange the OAuth code from the install redirect and return which
   * installations that account can see.
   *
   * This is the claim proof, and it has no fallback: matching the installation's
   * `account.login` against the caller's linked GitHub account fails for
   * organization installations, where that login is the org rather than a user
   * (`product/versions/mvp/00-scope.md`). The code is used once, here, and never
   * stored.
   */
  listUserInstallations(code: string): Promise<GithubInstallationRef[]>;
  /**
   * What GitHub says about one installation right now, read with the App's own
   * JWT rather than taken from the redirect.
   *
   * It is a separate call because the suspension is the part a claim cannot be
   * trusted for: without it, re-posting the redirect would clear a suspension
   * GitHub still holds, and the row would look usable until a webhook said
   * otherwise.
   */
  readInstallation(githubInstallationId: number): Promise<GithubInstallationClaim>;
  /** Every repository the installation covers, read through its own token. */
  listInstallationRepositories(githubInstallationId: number): Promise<GithubRepository[]>;
  /**
   * One repository, by GitHub's own id.
   *
   * GitHub refuses it when the installation does not cover it, and that refusal
   * *is* `GITHUB_010` — which is why naming one repository is a lookup here rather
   * than a `find()` over the installation's whole catalogue.
   */
  readRepository(githubInstallationId: number, githubRepoId: number): Promise<GithubRepository>;
  /** One repository's branches, plus which of them is the default. */
  listRepositoryBranches(
    githubInstallationId: number,
    githubRepoId: number,
  ): Promise<{ branches: GithubBranch[]; defaultBranch: string }>;
  /**
   * An installation access token narrowed to one repository, with contents and
   * metadata only, valid for an hour.
   *
   * A live call every time — nothing caches the result — so it fails the moment
   * the repository leaves the installation or the App's permissions narrow.
   */
  mintRepositoryToken(
    githubInstallationId: number,
    githubRepoId: number,
  ): Promise<GithubRepositoryToken>;
}
