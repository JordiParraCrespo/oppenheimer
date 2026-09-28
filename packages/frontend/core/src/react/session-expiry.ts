'use client';

import { MutationCache, QueryCache, type QueryClientConfig } from '@tanstack/query-core';
import { AppError } from '../modules/core/errors';
import { defaultQueryClientOptions } from './persistence';

/** What the handlers need from the app: the one call that ends the session. */
export interface SessionExpiryTarget {
  auth: { expireSession(): boolean };
}

/** An API answer saying the caller's session is no longer honoured. */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof AppError && error.status === 401;
}

/**
 * Whether a failed query is worth asking again.
 *
 * A refusal the server explained (a 4xx) will be refused again: retrying a
 * 404, a 403 or a 401 only delays the error by a round-trip. A server error
 * (5xx) or a request that never got an answer (no status) gets one more try.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof AppError && error.status !== undefined && error.status < 500) return false;
  return failureCount < 1;
}

/**
 * The query client every app builds: {@link defaultQueryClientOptions}, plus a
 * cache that notices a session the server stopped honouring.
 *
 * Without it, a session that expires mid-use leaves the auth store believing
 * in it, and every screen shows its own generic failure instead of the sign-in
 * page. With it, the first 401 flips the store, and the router's guards —
 * which subscribe to that store — send the user to /login with a `redirect`
 * back to where they were.
 *
 * `expireSession()` does nothing while the store says nobody is signed in, so
 * a 401 on the sign-in screens — a wrong password, not an expired session —
 * leaves them alone.
 */
export function createQueryClientConfig(
  app: SessionExpiryTarget,
  staleTime: number,
): QueryClientConfig {
  const onError = (error: unknown) => {
    if (isUnauthorized(error)) app.auth.expireSession();
  };
  const defaults = defaultQueryClientOptions(staleTime);

  return {
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      ...defaults,
      queries: { ...defaults.queries, retry: shouldRetryQuery },
    },
  };
}
