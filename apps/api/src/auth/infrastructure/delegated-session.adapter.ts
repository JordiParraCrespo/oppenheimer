import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { describeError } from '@oppenheimer/backend-core';
import { auth } from './better-auth.config';
import type { DelegatedSessionPort, DelegatedSessionRequest } from './delegated-session.port';

/** How long a delegated session lives before it must be re-minted. */
const SESSION_TTL_SECONDS = 10 * 60;

/** Cache entries expire a little early so a cached token is never past its use. */
const CACHE_TTL_SECONDS = SESSION_TTL_SECONDS - 60;

/**
 * How recently a delegated row must have been created to be left alone by the
 * sweep below.
 *
 * Two requests for the same credential can miss the cache at once (at expiry,
 * after an invalidation, through a Redis outage) and each mints a session.
 * Without this window each sweep would delete the other's row, and if both
 * list before either deletes, both go while the cache still serves one of the
 * tokens: every façade call through it fails until the entry expires. The
 * cache offers no atomic primitive to build a lock from.
 *
 * A superseded row is {@link CACHE_TTL_SECONDS} old when replaced; a concurrent
 * sibling or an in-flight row is milliseconds old, and a minute sits far from
 * both. Concurrent duplicates expire on their own ten-minute schedule or go
 * with the next remint.
 */
const RETIREMENT_GRACE_SECONDS = 60;

/**
 * How long a user's cache generation lives. It must comfortably outlive
 * {@link CACHE_TTL_SECONDS}: if the stamp expired first, the current generation
 * would fall back to {@link INITIAL_GENERATION} while entries written under it
 * were still cached, resurrecting sessions a bulk revocation had retired.
 */
const GENERATION_TTL_SECONDS = 24 * 60 * 60;

/** The generation used until a user first revokes something. */
const INITIAL_GENERATION = 'initial';

/**
 * What is cached per credential: the session token, and the user's generation
 * it was minted under. The entry answers only while that generation is still
 * the user's current one.
 */
interface CachedDelegatedSession {
  token: string;
  generation: string;
}

/**
 * Bridges scoped credentials to the Better Auth session world.
 *
 * The façade modules (organizations, admin, profile) call Better Auth's server
 * API, which resolves the caller from a session. An API token or OAuth access
 * token has none, so this mints a short-lived one for the credential's owner;
 * the auth guard presents it as `Authorization: Bearer <token>` to the Better
 * Auth `bearer` plugin. Only routes marked `@UsesBetterAuthSession()` ask for
 * one.
 *
 * Sessions are cached per credential (one mint per ten minutes; a lookup is one
 * Redis round trip for the entry and the user's generation), and each remint
 * deletes the row it supersedes. Rows are marked `delegated` to keep them out
 * of "Active sessions": a "Sign out" button there would promise a revocation it
 * cannot deliver, since the credential mints another on its next request.
 * Tokens and grants are revoked where they are managed.
 */
@Injectable()
export class DelegatedSessionAdapter implements DelegatedSessionPort {
  private readonly logger = new Logger(DelegatedSessionAdapter.name);

  constructor(private readonly cache: CacheService) {}

  async resolveSessionToken(options: DelegatedSessionRequest): Promise<string | null> {
    const key = this.cacheKey(options.credentialId);
    let generation: string;

    try {
      const [cached, current] = await this.cache.mget<CachedDelegatedSession | string>([
        key,
        this.generationKey(options.userId),
      ]);
      generation = typeof current === 'string' ? current : INITIAL_GENERATION;
      // An entry minted under an older generation was retired by a bulk
      // revocation, whose rows are gone: a miss, and a fresh session.
      if (isCachedSession(cached) && cached.generation === generation) return cached.token;
    } catch (error) {
      // A cache outage must not take the API down; fall through and mint.
      // Falling back to the initial stamp could hand back an entry a bump had
      // already retired, so tag the new entry with one nothing is current
      // under: the next read misses and mints again.
      this.logger.warn(`Delegated session cache read failed: ${describeError(error)}`);
      generation = randomUUID();
    }

    try {
      const context = await auth.$context;
      const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
      const session = await context.internalAdapter.createSession(
        options.userId,
        true,
        {
          expiresAt,
          userAgent: options.label,
          // What makes the row a credential bridge rather than a device, both
          // for the profile session list and for the sweep below.
          delegated: true,
          delegatedCredentialId: options.credentialId,
          ...(options.activeOrganizationId
            ? { activeOrganizationId: options.activeOrganizationId }
            : {}),
        },
        // Better Auth spreads the override, then writes its *own* `expiresAt`
        // over it — 24 hours, for `dontRememberMe` — and only re-applies the
        // override when told to override all of it. Without this flag the ten
        // minutes above are silently ignored and every remint leaves a
        // day-long row behind.
        true,
      );

      await this.cache
        .set<CachedDelegatedSession>(key, { token: session.token, generation }, CACHE_TTL_SECONDS)
        .catch((error) =>
          this.logger.warn(`Delegated session cache write failed: ${describeError(error)}`),
        );

      await this.retireSuperseded(options.credentialId, options.userId, session.token);

      return session.token;
    } catch (error) {
      this.logger.error(`Could not mint a delegated session: ${describeError(error)}`);
      return null;
    }
  }

  /**
   * Delete the rows this credential's new session supersedes: a credential in
   * steady use remints every nine minutes, and the old rows would otherwise
   * live until expiry, unreachable. Rows younger than
   * {@link RETIREMENT_GRACE_SECONDS} are a concurrent miss's sibling or still in
   * flight, and are left alone. Best-effort: the new session is already minted
   * and cached, so a failed sweep must not fail the request.
   */
  private async retireSuperseded(
    credentialId: string,
    userId: string,
    keepToken: string,
  ): Promise<void> {
    try {
      const context = await auth.$context;
      const sessions = (await context.internalAdapter.listSessions(userId, {
        onlyActiveSessions: true,
      })) as (Awaited<ReturnType<typeof context.internalAdapter.listSessions>>[number] & {
        delegatedCredentialId?: string | null;
      })[];

      const retireBefore = Date.now() - RETIREMENT_GRACE_SECONDS * 1000;
      const superseded = sessions
        .filter(
          (session) =>
            session.delegatedCredentialId === credentialId &&
            session.token !== keepToken &&
            new Date(session.createdAt).getTime() < retireBefore,
        )
        .map((session) => session.token);

      if (superseded.length === 0) return;
      await context.internalAdapter.deleteSessions(superseded);
    } catch (error) {
      this.logger.warn(`Superseded delegated sessions were not retired: ${describeError(error)}`);
    }
  }

  async invalidate(credentialId: string, _userId: string): Promise<void> {
    await this.cache
      .del(this.cacheKey(credentialId))
      .catch((error) =>
        this.logger.warn(`Delegated session eviction failed: ${describeError(error)}`),
      );
  }

  /**
   * Drop every delegated session cached for a user, without knowing which
   * credentials they hold. Bulk revocations (signing out other devices, a
   * password change) delete the delegated rows, and a credential still
   * presenting the cached token would fail every façade call until the entry
   * expired. The cache has no wildcard delete and the credential ids span API
   * tokens and OAuth grants, so one write rotates the user's generation stamp
   * and every entry minted under the old one stops answering.
   */
  async invalidateForUser(userId: string): Promise<void> {
    await this.cache
      .set(this.generationKey(userId), randomUUID(), GENERATION_TTL_SECONDS)
      .catch((error) =>
        this.logger.warn(`Delegated session generation bump failed: ${describeError(error)}`),
      );
  }

  private cacheKey(credentialId: string): string {
    return `delegated-session:${credentialId}`;
  }

  private generationKey(userId: string): string {
    return `delegated-session-generation:${userId}`;
  }
}

function isCachedSession(value: unknown): value is CachedDelegatedSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CachedDelegatedSession).token === 'string' &&
    typeof (value as CachedDelegatedSession).generation === 'string'
  );
}
