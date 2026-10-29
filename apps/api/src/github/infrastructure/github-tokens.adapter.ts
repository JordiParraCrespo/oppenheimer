import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { GithubTokenKind } from '@oppenheimer/shared';
import { GithubErrors } from '../domain/github.errors';
import type { GithubRepository } from './github-app.port';
import { GithubHttp } from './github-http.adapter';
import type { GithubBucket } from './github-pulls.port';
import {
  type GithubTokenInspection,
  type GithubTokensPort,
  MAX_TOKEN_REPOSITORIES,
} from './github-tokens.port';

interface RawUser {
  id: number;
  login: string;
}

interface RawRepository {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  archived: boolean;
  pushed_at: string | null;
}

/**
 * A person's own token on GitHub, through {@link GithubHttp} like every other
 * call. Budget: the first call (`GET /user`) is counted against a digest of
 * the token, since GitHub has not yet said whose it is; the listing after it
 * against the person (`user:<id>`), whose 5,000 requests an hour every token
 * of theirs shares. One check is one request plus a page per hundred
 * repositories, at most eleven.
 *
 * **Nothing here logs a token, and the token never becomes a key.**
 */
@Injectable()
export class GithubTokensAdapter implements GithubTokensPort {
  constructor(private readonly http: GithubHttp) {}

  async inspect(token: string): Promise<GithubTokenInspection> {
    const { body: user, headers } = await this.http.request<RawUser>(`${this.http.api}/user`, {
      bucket: digestBucket(token),
      token,
      unauthorized: GithubErrors.TOKEN_REFUSED,
    });
    const repositories = await this.http.paginate<RawRepository>(
      `${this.http.api}/user/repos?affiliation=owner,collaborator,organization_member&sort=pushed`,
      { bucket: `user:${user.id}`, token, unauthorized: GithubErrors.TOKEN_REFUSED },
      (body) => (Array.isArray(body) ? (body as RawRepository[]) : []),
      Math.ceil(MAX_TOKEN_REPOSITORIES / 100),
    );
    return {
      kind: kindOf(token),
      githubUserId: user.id,
      login: user.login,
      scopes: headers.get('x-oauth-scopes'),
      expiresAt: expiryOf(headers.get('github-authentication-token-expiration')),
      repositories: repositories.slice(0, MAX_TOKEN_REPOSITORIES).map(toRepository),
    };
  }
}

/** GitHub's prefixes say what a token is: `github_pat_` fine-grained, `ghp_` classic. */
function kindOf(token: string): GithubTokenKind {
  if (token.startsWith('github_pat_')) return 'fine_grained';
  if (token.startsWith('ghp_')) return 'classic';
  return 'other';
}

/** `2026-12-31 23:59:59 UTC`, or with an offset (`+0100`); null when absent or unreadable. */
function expiryOf(header: string | null): Date | null {
  if (!header) return null;
  const at = new Date(
    header
      .replace(' UTC', 'Z')
      .replace(' ', 'T')
      .replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2'),
  );
  return Number.isNaN(at.getTime()) ? null : at;
}

function digestBucket(token: string): GithubBucket {
  return `token:${createHash('sha256').update(token).digest('hex').slice(0, 16)}`;
}

function toRepository(repository: RawRepository): GithubRepository {
  return {
    githubRepoId: repository.id,
    name: repository.name,
    fullName: repository.full_name,
    defaultBranch: repository.default_branch,
    private: repository.private,
    archived: repository.archived,
    pushedAt: repository.pushed_at ?? null,
  };
}
