'use client';

import {
  MutationCache,
  QueryCache,
  QueryClient,
  type QueryClientConfig,
} from '@tanstack/query-core';
import { CORE_CONFIG } from '../config';
import { defaultQueryClientOptions } from './persistence';
import { authKeys } from './query-keys';

/**
 * The query client every app builds, and the two policies it applies to every
 * failure it sees. Both read the failure's HTTP `status`, so both depend on
 * one contract: a query or mutation function rejects with the status the
 * server answered. Repositories hold it by going through `unwrap` /
 * `unwrapBody` (`@oppenheimer/frontend-core`), which keep the status on the
 * `AppError` they throw, and Better Auth's client keeps it on its own error. A
 * rejection with no status — a request that got no answer — is treated as
 * exactly that.
 */

/** What the expiry needs from the app: the one call that ends the session. */
export interface SessionExpiryTarget {
  auth: { expireSession(): boolean };
}

/** The HTTP status a failure carries, whatever threw it; `undefined` without one. */
function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { status } = error as { status?: unknown };
  return typeof status === 'number' ? status : undefined;
}

/** An API answer saying the caller's session is no longer honoured. */
function isUnauthorized(error: unknown): boolean {
  return statusOf(error) === 401;
}

/**
 * Retry policy: whether a failed query is worth asking again.
 *
 * A refusal the server explained (a 4xx) will be refused again: retrying a
 * 404, a 403 or a 401 only delays the error by a round-trip. A server error
 * (5xx) or a request that never got an answer (no status) gets one more try.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = statusOf(error);
  if (status !== undefined && status < 500) return false;
  return failureCount < CORE_CONFIG.query.retries;
}

/**
 * Session expiry: the server stopped honouring the session, so the app stops
 * believing in it, and forgets what it cached under it.
 *
 * Flipping the auth store is what sends the reader to /login: the router's
 * guards subscribe to it. Forgetting the cache is what keeps the next person
 * to sign in on this tab from seeing the previous account's sessions and
 * projects before their own arrive — a logout clears it too. The session
 * query is spared, as `reconcileCacheOwner` spares it, because it is the
 * record of who is signed in.
 *
 * Does nothing while the store says nobody is signed in, so a 401 on the
 * sign-in screens — a wrong password, not an expired session — leaves them
 * and their cache alone.
 */
export function expireSession(app: SessionExpiryTarget, queryClient: QueryClient): void {
  if (!app.auth.expireSession()) return;
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== authKeys.all[0] });
}

/**
 * The client, with {@link defaultQueryClientOptions}, the retry policy, and a
 * cache that expires the session on the first 401 any query or mutation sees.
 */
export function createQueryClient(
  app: SessionExpiryTarget,
  staleTime: number = CORE_CONFIG.query.staleTimeMs,
): QueryClient {
  const onError = (error: unknown) => {
    if (isUnauthorized(error)) expireSession(app, queryClient);
  };
  const defaults = defaultQueryClientOptions(staleTime);
  const config: QueryClientConfig = {
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      ...defaults,
      queries: { ...defaults.queries, retry: shouldRetryQuery },
    },
  };
  const queryClient = new QueryClient(config);
  return queryClient;
}
