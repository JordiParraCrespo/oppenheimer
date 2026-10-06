/**
 * What the application needs from the GitHub App, in this module's own
 * vocabulary. Nothing of GitHub's wire shape crosses this line — the vendor
 * stops at `github-rest.adapter.ts`, the only file that talks to it.
 */

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

/**
 * A person's GitHub user token, as the user authorization hands it over: with
 * expiring user tokens an eight-hour access token and a six-month refresh token,
 * without them one token and no expiry. Live credentials: never logged.
 */
export interface GithubUserTokens {
  accessToken: string;
  accessExpiresAt: Date | null;
  refreshToken: string | null;
  refreshExpiresAt: Date | null;
}

/** Who authorized: GitHub's own id and login for the account behind the token. */
export interface GithubUserIdentity {
  githubUserId: number;
  login: string;
}

/** What one install redirect's code proves, and the token it was exchanged for. */
export interface GithubUserAuthorization {
  installations: GithubInstallationRef[];
  user: GithubUserIdentity;
  tokens: GithubUserTokens;
}

export interface GithubAppPort {
  isConfigured(): boolean;
  /**
   * Exchange the OAuth code from the install redirect and return which
   * installations that account can see.
   *
   * This is the claim proof, and it has no fallback: matching the installation's
   * `account.login` against the caller's linked GitHub account fails for
   * organization installations, where that login is the org rather than a user
   * (`product/versions/mvp/10-api-modules-and-data-model.md`). The code is used once, here, and never
   * stored. The user token it is exchanged for comes back with it, with the
   * account it belongs to, so the Pull requests area can later act in that
   * person's name; the caller decides whether to keep it.
   */
  listUserInstallations(code: string): Promise<GithubUserAuthorization>;
  /** A fresh user token from a refresh token; GitHub rotates the refresh token too. */
  refreshUserToken(refreshToken: string): Promise<GithubUserTokens>;
  /**
   * A token for the whole installation with the App's own permissions, valid for
   * an hour: what the Pull requests area reads repositories through when nobody's
   * user token is involved. Never stored.
   */
  mintInstallationToken(githubInstallationId: number): Promise<GithubRepositoryToken>;
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
  listInstallationRepositories(githubInstallationId: number): Promise<GithubRepository[]>;
  /**
   * One repository, by GitHub's own id.
   *
   * GitHub refuses it when the installation does not cover it, and that refusal
   * *is* `GITHUB_010` — which is why naming one repository is a lookup here rather
   * than a `find()` over the installation's whole catalogue.
   */
  readRepository(githubInstallationId: number, githubRepoId: number): Promise<GithubRepository>;
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
