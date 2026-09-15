'use client';

import type { Query, QueryClient } from '@tanstack/query-core';
import { apiTokensKeys } from './api-tokens.queries';
import { authKeys } from './auth.queries';
import { profileKeys } from './profile.queries';

/**
 * How long a restored cache entry stays usable before the persister throws it
 * away. Entries older than this are dropped on restore, so a user who comes
 * back after a week never sees week-old data flash on screen.
 */
export const QUERY_PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * `gcTime` for the persisted client. It must be **at least** `maxAge`: React
 * Query garbage-collects an unused query after `gcTime`, and a collected query
 * is not written to storage, so a shorter `gcTime` would silently persist
 * nothing. Both apps get this from {@link defaultQueryClientOptions}.
 */
export const QUERY_PERSIST_GC_TIME = QUERY_PERSIST_MAX_AGE;

let nonPersistedFeatures: ReadonlySet<string> | undefined;

/**
 * Features whose queries never leave memory.
 *
 * - `auth` — the session query is `staleTime: Infinity`, so a restored entry
 *   would be treated as fresh forever and `restoreSession()` would never run.
 *   The Zustand auth store is rebuilt by that call, so persisting it would
 *   leave the app looking signed in with no session behind it.
 * - `apiTokens` — credential metadata (token prefixes, scopes, the permission
 *   catalog). Cheap to refetch, and not something to leave sitting in
 *   localStorage or AsyncStorage, neither of which is encrypted at rest.
 * - `profile` — its data is **class instances**, and a prototype does not
 *   survive JSON. Restored, the entity's getters are gone and its dates come
 *   back as strings, and the screens format them through `Intl`, which throws
 *   `Invalid time value` — a hard refresh rendered the error boundary instead
 *   of the page. Small and cheap to refetch. Any new feature whose query
 *   resolves to a class instance belongs on this list too.
 *
 * Built on first use rather than at module scope: `auth.queries` imports this
 * module for {@link reconcileCacheOwner}, so reading `authKeys` while this
 * module is still evaluating would hit the temporal dead zone whenever the
 * cycle is entered from that side.
 */
function getNonPersistedFeatures(): ReadonlySet<string> {
  nonPersistedFeatures ??= new Set([authKeys.all[0], apiTokensKeys.all[0], profileKeys.all[0]]);
  return nonPersistedFeatures;
}

/**
 * Whether a query may be written to storage.
 *
 * Only successful queries are persisted — restoring an error or a pending
 * fetch would replay a failure the user has already moved past. The feature
 * segment is the first entry of every key factory (see the "React Query keys"
 * guide), which is what makes a per-feature deny-list possible.
 */
export function shouldDehydrateQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false;

  const [feature] = query.queryKey;
  return typeof feature === 'string' && !getNonPersistedFeatures().has(feature);
}

/**
 * Records which user a persisted cache belongs to. Persisted like any other
 * successful query, so it travels with the cache it describes.
 */
export const cacheOwnerKey = ['cacheOwner'] as const;

/**
 * Drops a restored cache that doesn't belong to the user who is signed in now.
 *
 * A persisted cache outlives its session: it survives an expired or
 * server-revoked session, and a tab closed right after logout can beat the
 * persister's throttled write to storage. Without this, the next boot hydrates
 * the previous user's `users`/`organizations` entries, and the next person on
 * that browser or device sees them flash before the refetch lands.
 *
 * So on every session restore the restored cache is reconciled against the
 * signed-in user: same user, keep it; anyone else — including nobody, and
 * including a cache with no owner recorded — throw the non-`auth` entries away.
 * `auth` is spared because the session query driving this call is one of them.
 *
 * Called from `useSessionRestore`'s `queryFn`, i.e. before the query resolves
 * and before either app's gate renders anything, so no component ever observes
 * another user's data.
 */
export function reconcileCacheOwner(queryClient: QueryClient, ownerId: string | null): void {
  const previousOwnerId = queryClient.getQueryData<string>(cacheOwnerKey) ?? null;
  if (ownerId !== null && previousOwnerId === ownerId) return;

  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== authKeys.all[0],
  });

  if (ownerId !== null) queryClient.setQueryData(cacheOwnerKey, ownerId);
}

/**
 * Increment when the persistence policy changes in a way that makes an
 * already-stored cache unsafe to hydrate. This revision drops profile/session
 * entities written before they were excluded from persistence.
 */
const QUERY_PERSIST_REVISION = 2;

/**
 * Persistence options shared by web and mobile. The apps supply the platform's
 * `persister` (localStorage on web, AsyncStorage on mobile) and spread this in.
 *
 * `buster` combines the app version with the cache-policy revision: releases
 * drop incompatible response shapes, while a policy fix can invalidate unsafe
 * entries before the next version bump.
 */
export function createQueryPersistOptions(appVersion: string) {
  return {
    maxAge: QUERY_PERSIST_MAX_AGE,
    buster: `${appVersion}:${QUERY_PERSIST_REVISION}`,
    dehydrateOptions: { shouldDehydrateQuery },
  };
}

/**
 * Query defaults shared by web and mobile. `gcTime` is pinned to the persist
 * window; `staleTime` is per-app because "how stale is too stale" differs
 * between a tab that stays open and an app resumed from the background.
 */
export function defaultQueryClientOptions(staleTime: number) {
  return {
    queries: {
      staleTime,
      gcTime: QUERY_PERSIST_GC_TIME,
      retry: 1,
    },
  };
}
