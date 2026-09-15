import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { auth } from '../auth';

/** How long a delegated session lives before it must be re-minted. */
const SESSION_TTL_SECONDS = 10 * 60;

/** Cache entries expire a little early so a cached token is never past its use. */
const CACHE_TTL_SECONDS = SESSION_TTL_SECONDS - 60;

/**
 * How recently a delegated row must have been created to be left alone by the
 * sweep below.
 *
 * Two requests for the same credential can miss the cache at the same instant —
 * at expiry, after an invalidation, or throughout a Redis outage — and each
 * mints a session. Without this window each one's sweep would read the other's
 * row as superseded and delete it, and if both list before either deletes,
 * *both* rows go while the cache still serves one of those tokens: every façade
 * call through that credential then fails until the entry expires nine minutes
 * later. A lock would be the other answer, but the cache offers no atomic
 * primitive to build one from.
 *
 * Age is what actually separates the two cases. The row a remint supersedes was
 * created when its cache entry was written, so it is {@link CACHE_TTL_SECONDS}
 * old by the time anything replaces it; a sibling from a concurrent miss is
 * milliseconds old, as is a row a request in flight is still presenting. A
 * minute sits far from both. Concurrent duplicates are left to expire on their
 * own ten-minute schedule and to be swept by the next remint — bounded, unlike
 * the day-long accumulation this sweep exists to stop.
 */
const RETIREMENT_GRACE_SECONDS = 60;

/**
 * How long a user's cache generation lives. It must comfortably outlive
 * {@link CACHE_TTL_SECONDS}: if the stamp expired first, keys would fall back to
 * {@link INITIAL_GENERATION} while entries written under it were still cached,
 * resurrecting sessions a bulk revocation had retired.
 */
const GENERATION_TTL_SECONDS = 24 * 60 * 60;

/** The generation used until a user first revokes something. */
const INITIAL_GENERATION = 'initial';

/**
 * Bridges scoped credentials to the Better Auth session world.
 *
 * Several modules (organizations, members, invitations, workspaces, admin) are
 * façades over Better Auth's server API, which resolves the caller from their
 * session. An API token or OAuth access token carries no such session, so this
 * service mints a short-lived one for the credential's owner and hands back its
 * token; the auth guard then presents it as `Authorization: Bearer <token>`,
 * which the Better Auth `bearer` plugin accepts.
 *
 * Sessions are cached per credential so a busy token creates one session every
 * ten minutes rather than one per request, and each remint deletes the row it
 * supersedes so an active credential holds one row, not a day's worth.
 *
 * The rows are marked `delegated` (see `auth.ts`), which keeps them out of the
 * profile and security "Active sessions" lists: they are bridges, not devices,
 * and offering someone a "Sign out" button for one would promise a revocation
 * it cannot deliver — the credential mints another on its next request. API
 * tokens and OAuth grants are revoked where they are managed.
 */
@Injectable()
export class DelegatedSessionService {
  private readonly logger = new Logger(DelegatedSessionService.name);

  constructor(private readonly cache: CacheService) {}

  /**
   * A Better Auth session token acting as `userId`, reused across requests
   * from the same credential. Returns `null` if a session could not be minted
   * — callers fall back to scope-only access rather than failing the request,
   * since most routes never touch the Better Auth API.
   */
  async resolveSessionToken(options: {
    credentialId: string;
    userId: string;
    label: string;
    /** Set as the session's active organization, when the credential pins one. */
    activeOrganizationId?: string | null;
  }): Promise<string | null> {
    const generation = await this.generationFor(options.userId);
    const key = this.cacheKey(options.credentialId, generation);

    try {
      const cached = await this.cache.get<string>(key);
      if (cached) return cached;
    } catch (error) {
      // A cache outage must not take the API down; fall through and mint.
      this.logger.warn(`Delegated session cache read failed: ${describe(error)}`);
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
        // day-long row behind: the reason one account came to show 23 devices.
        true,
      );

      await this.cache
        .set(key, session.token, CACHE_TTL_SECONDS)
        .catch((error) =>
          this.logger.warn(`Delegated session cache write failed: ${describe(error)}`),
        );

      await this.retireSuperseded(options.credentialId, options.userId, session.token);

      return session.token;
    } catch (error) {
      this.logger.error(`Could not mint a delegated session: ${describe(error)}`);
      return null;
    }
  }

  /**
   * Delete the rows this credential's new session supersedes.
   *
   * A cached token is dropped a minute before its session expires, so a
   * credential in steady use mints a new one every nine minutes. Without this
   * the superseded rows stayed until they expired — one live row per remint,
   * all of them the same credential, none of them reachable by anything.
   *
   * Only rows older than {@link RETIREMENT_GRACE_SECONDS} are touched: a
   * younger one is a sibling from a concurrent cache miss, or a row a request
   * still in flight is presenting, and deleting either breaks a request to tidy
   * a table.
   *
   * Best-effort: the new session is already minted and cached, and a sweep that
   * could fail the request would trade a tidy table for a broken one.
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
      this.logger.warn(`Superseded delegated sessions were not retired: ${describe(error)}`);
    }
  }

  /** Drop the cached session for a credential (used when it is revoked). */
  async invalidate(credentialId: string, userId: string): Promise<void> {
    const generation = await this.generationFor(userId);
    await this.cache
      .del(this.cacheKey(credentialId, generation))
      .catch((error) => this.logger.warn(`Delegated session eviction failed: ${describe(error)}`));
  }

  /**
   * Drop every delegated session cached for a user, without needing to know
   * which credentials they hold.
   *
   * Needed whenever their sessions are revoked in bulk — signing out other
   * devices, or changing a password, which revokes them by default. Those
   * delete the delegated session *rows*, and a credential still presenting the
   * cached token then fails every facade call until the entry expires on its
   * own.
   *
   * Rotating a generation stamp rather than deleting keys is what makes this
   * possible: the cache offers no wildcard delete, and the credential ids are
   * spread across API tokens and OAuth grants. One write moves the user onto
   * fresh keys and every stale entry becomes unreachable at once.
   */
  async invalidateForUser(userId: string): Promise<void> {
    await this.cache
      .set(this.generationKey(userId), randomUUID(), GENERATION_TTL_SECONDS)
      .catch((error) =>
        this.logger.warn(`Delegated session generation bump failed: ${describe(error)}`),
      );
  }

  /**
   * The user's current cache generation, defaulting to a fixed stamp when none
   * is set — the common case, since a generation only exists once they have
   * revoked something.
   */
  private async generationFor(userId: string): Promise<string> {
    try {
      const generation = await this.cache.get<string>(this.generationKey(userId));
      return generation ?? INITIAL_GENERATION;
    } catch (error) {
      // Falling back to the initial stamp on a cache outage could hand back an
      // entry a bump had already retired, so use one nothing can be cached
      // under: the read below misses and a fresh session is minted.
      this.logger.warn(`Delegated session generation read failed: ${describe(error)}`);
      return randomUUID();
    }
  }

  private cacheKey(credentialId: string, generation: string): string {
    return `delegated-session:${credentialId}:${generation}`;
  }

  private generationKey(userId: string): string {
    return `delegated-session-generation:${userId}`;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
