import type { GithubTokenKind } from '@oppenheimer/shared';
import type { GithubRepository } from './github-app.port';

/**
 * What GitHub says about a person's own token
 * (`product/next-steps/0.2-pull-requests.md` §6.2): whose it is, when it
 * expires, and what it opens. A live credential goes in and never comes out.
 */
export interface GithubTokenInspection {
  kind: GithubTokenKind;
  githubUserId: number;
  login: string;
  /** A classic token's scopes, from `x-oauth-scopes`; null for the others. */
  scopes: string | null;
  /** From `github-authentication-token-expiration`; null when GitHub names none. */
  expiresAt: Date | null;
  /** What the token opens, as `GET /user/repos` lists it, up to {@link MAX_TOKEN_REPOSITORIES}. */
  repositories: GithubRepository[];
}

/** Ten pages of a hundred: a classic token can see far more, and the picker searches what is kept. */
export const MAX_TOKEN_REPOSITORIES = 1_000;

export interface GithubTokensPort {
  /**
   * Asks GitHub about the token. `GITHUB_018` when GitHub answers `401`;
   * a rate limit is `GITHUB_015` as everywhere.
   */
  inspect(token: string): Promise<GithubTokenInspection>;
}
