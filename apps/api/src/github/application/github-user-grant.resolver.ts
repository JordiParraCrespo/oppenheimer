import { Inject, Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import type {
  GithubUserGrantRecord,
  GithubUserGrantRepositoryPort,
} from '../database/github-user-grant.repository.port';
import { GITHUB_APP, GITHUB_USER_GRANT_REPOSITORY, USER_TOKEN_SEALER } from '../github.di-tokens';
import type {
  GithubAppPort,
  GithubUserIdentity,
  GithubUserTokens,
} from '../infrastructure/github-app.port';
import type { UserTokenSealerPort } from '../infrastructure/user-token-sealer.port';

/** Refreshed this long before GitHub's expiry, so a request never races it. */
const REFRESH_MARGIN_MS = 5 * 60_000;
/** One refresh per person at a time: GitHub rotates the refresh token on every use. */
const REFRESH_LOCK_SECONDS = 30;

/** A usable user token and the account it acts as. A live credential: never logged. */
export interface GithubActor {
  token: string;
  login: string;
  githubUserId: number;
}

/**
 * A person's GitHub user token: kept from the install's user authorization,
 * opened and refreshed when the Pull requests area acts in their name
 * (`product/next-steps/0.2-pull-requests-api-plan.md` §3).
 *
 * A grant that cannot be opened (sealed under a replaced key) or refreshed
 * (revoked on GitHub, refresh token expired) is dropped, and the person is asked
 * to connect GitHub again; nothing falls back to acting as somebody else.
 */
@Injectable()
export class GithubUserGrantResolver {
  private readonly logger = new Logger(GithubUserGrantResolver.name);

  constructor(
    @Inject(GITHUB_USER_GRANT_REPOSITORY)
    private readonly grants: GithubUserGrantRepositoryPort,
    @Inject(USER_TOKEN_SEALER)
    private readonly sealer: UserTokenSealerPort,
    @Inject(GITHUB_APP)
    private readonly github: GithubAppPort,
    private readonly cache: CacheService,
  ) {}

  /** Keeps what an install redirect handed over. Without a key there is nothing to keep it under. */
  async keep(userId: string, user: GithubUserIdentity, tokens: GithubUserTokens): Promise<void> {
    if (!this.sealer.isConfigured()) return;
    await this.grants.upsert({
      userId,
      githubUserId: user.githubUserId,
      login: user.login,
      ...this.sealed(tokens),
    });
  }

  /** The person's login on GitHub, or null when they have not connected. */
  async loginOf(userId: string): Promise<string | null> {
    return (await this.grants.findByUserId(userId))?.login ?? null;
  }

  /** A token to act as the person with, refreshed when it is about to lapse; null when there is none. */
  async actorFor(userId: string): Promise<GithubActor | null> {
    if (!this.sealer.isConfigured()) return null;
    const grant = await this.grants.findByUserId(userId);
    if (!grant) return null;
    try {
      if (isFresh(grant)) return this.actorOf(grant, this.sealer.open(grant.accessTokenSealed));
      const lapsed =
        grant.refreshExpiresAt !== null && grant.refreshExpiresAt.getTime() <= Date.now();
      if (!grant.refreshTokenSealed || lapsed) throw new Error('The refresh token has lapsed');
      const lock = `github:user-grant:refresh:${userId}`;
      if (!(await this.cache.setIfAbsent(lock, 1, REFRESH_LOCK_SECONDS))) {
        // Another request holds the refresh: read what it stored, and never drop the grant over a race.
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        const after = await this.grants.findByUserId(userId);
        return after && isFresh(after)
          ? this.actorOf(after, this.sealer.open(after.accessTokenSealed))
          : null;
      }
      const tokens = await this.github.refreshUserToken(this.sealer.open(grant.refreshTokenSealed));
      await this.grants.upsert({ ...grant, ...this.sealed(tokens) });
      await this.cache.del(lock);
      return this.actorOf(grant, tokens.accessToken);
    } catch (error) {
      this.logger.warn({
        message: 'A GitHub user grant could not be used; the person must connect again',
        userId,
        reason: error instanceof Error ? error.message : String(error),
      });
      await this.grants.deleteByUserId(userId);
      return null;
    }
  }

  private actorOf(grant: GithubUserGrantRecord, token: string): GithubActor {
    return { token, login: grant.login, githubUserId: grant.githubUserId };
  }

  private sealed(tokens: GithubUserTokens) {
    return {
      accessTokenSealed: this.sealer.seal(tokens.accessToken),
      accessExpiresAt: tokens.accessExpiresAt,
      refreshTokenSealed: tokens.refreshToken ? this.sealer.seal(tokens.refreshToken) : null,
      refreshExpiresAt: tokens.refreshExpiresAt,
    };
  }
}

function isFresh(grant: GithubUserGrantRecord): boolean {
  return !grant.accessExpiresAt || grant.accessExpiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS;
}
