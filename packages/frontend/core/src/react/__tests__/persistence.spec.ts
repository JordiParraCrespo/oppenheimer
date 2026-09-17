import { type Query, QueryClient, type QueryKey, type QueryState } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';
import { authKeys } from '../auth.queries';

/** A product query key: any feature the kernel does not know about persists by default. */
const organizationsList = ['organizations', 'list'] as const;

import {
  cacheOwnerKey,
  createQueryPersistOptions,
  QUERY_PERSIST_GC_TIME,
  QUERY_PERSIST_MAX_AGE,
  reconcileCacheOwner,
  shouldDehydrateQuery,
} from '../persistence';
import { usersKeys } from '../users.queries';

/** A real `Query` in the given state — dehydration reads `state` and `queryKey`. */
function query(queryKey: QueryKey, status: QueryState['status'] = 'success'): Query {
  const client = new QueryClient();
  const q = client.getQueryCache().build(client, { queryKey });

  if (status === 'success') q.setState({ status: 'success', data: { ok: true } });
  if (status === 'error') q.setState({ status: 'error', error: new Error('boom') });

  return q;
}

describe('shouldDehydrateQuery', () => {
  it('persists ordinary feature queries', () => {
    expect(shouldDehydrateQuery(query(usersKeys.list()))).toBe(true);
    expect(shouldDehydrateQuery(query(usersKeys.me()))).toBe(true);
    expect(shouldDehydrateQuery(query(organizationsList))).toBe(true);
  });

  it('never persists the auth session or credential data', () => {
    expect(shouldDehydrateQuery(query(authKeys.session()))).toBe(false);
  });

  // Profile and session results are entities. A restored session turns its
  // Date fields into strings and the sessions pane's Intl formatter throws
  // "Invalid time value" on a warm start.
  it('keeps a product feature out of storage when the app names it', () => {
    expect(shouldDehydrateQuery(query(['profile', 'me']), ['auth', 'profile'])).toBe(false);
    expect(shouldDehydrateQuery(query(['profile', 'me']))).toBe(true);
  });

  it('only persists successful queries', () => {
    expect(shouldDehydrateQuery(query(usersKeys.list(), 'error'))).toBe(false);
    expect(shouldDehydrateQuery(query(usersKeys.list(), 'pending'))).toBe(false);
  });

  it('ignores keys that do not start with a feature string', () => {
    expect(shouldDehydrateQuery(query([{ scope: 'users' }]))).toBe(false);
  });
});

describe('createQueryPersistOptions', () => {
  it('caps restored entries at the persist window and busts on version', () => {
    const options = createQueryPersistOptions('1.2.3');

    expect(options.maxAge).toBe(QUERY_PERSIST_MAX_AGE);
    expect(options.buster).toBe('1.2.3:2');
    // The predicate is bound to the app's non-persisted features, so it is
    // checked by behaviour: a kernel-excluded key stays out, an unknown one
    // persists, and a feature the app names is kept out too.
    const { shouldDehydrateQuery: dehydrate } = options.dehydrateOptions;
    expect(dehydrate(query(authKeys.session()))).toBe(false);
    expect(dehydrate(query(organizationsList))).toBe(true);
    const named = createQueryPersistOptions('1.2.3', { nonPersistedFeatures: ['profile'] });
    expect(named.dehydrateOptions.shouldDehydrateQuery(query(['profile', 'me']))).toBe(false);
  });

  it('keeps queries alive at least as long as they are persisted', () => {
    // A query collected before it is written would persist nothing.
    expect(QUERY_PERSIST_GC_TIME).toBeGreaterThanOrEqual(QUERY_PERSIST_MAX_AGE);
  });
});

describe('reconcileCacheOwner', () => {
  /** A restored cache: one user-scoped entry, one auth entry, plus an owner. */
  function restoredCache(ownerId: string | null) {
    const client = new QueryClient();
    client.setQueryData(usersKeys.me(), { id: ownerId, name: 'Previous' });
    client.setQueryData(organizationsList, [{ id: 'org-1' }]);
    client.setQueryData(authKeys.session(), ownerId);
    if (ownerId) client.setQueryData(cacheOwnerKey, ownerId);
    return client;
  }

  it('keeps a cache that belongs to the signed-in user', () => {
    const client = restoredCache('user-1');

    reconcileCacheOwner(client, 'user-1');

    expect(client.getQueryData(usersKeys.me())).toEqual({
      id: 'user-1',
      name: 'Previous',
    });
    expect(client.getQueryData(organizationsList)).toEqual([{ id: 'org-1' }]);
  });

  it('drops a cache belonging to a different user', () => {
    const client = restoredCache('user-1');

    reconcileCacheOwner(client, 'user-2');

    expect(client.getQueryData(usersKeys.me())).toBeUndefined();
    expect(client.getQueryData(organizationsList)).toBeUndefined();
    expect(client.getQueryData(cacheOwnerKey)).toBe('user-2');
  });

  it('drops a cache when the session is gone', () => {
    const client = restoredCache('user-1');

    reconcileCacheOwner(client, null);

    expect(client.getQueryData(usersKeys.me())).toBeUndefined();
    expect(client.getQueryData(organizationsList)).toBeUndefined();
    expect(client.getQueryData(cacheOwnerKey)).toBeUndefined();
  });

  it('drops a cache with no recorded owner — it may predate the marker', () => {
    const client = restoredCache(null);
    client.setQueryData(usersKeys.me(), { id: 'user-1' });

    reconcileCacheOwner(client, 'user-2');

    expect(client.getQueryData(usersKeys.me())).toBeUndefined();
    expect(client.getQueryData(cacheOwnerKey)).toBe('user-2');
  });

  it('spares auth queries, which carry the in-flight session restore', () => {
    const client = restoredCache('user-1');

    reconcileCacheOwner(client, 'user-2');

    expect(client.getQueryData(authKeys.session())).toBe('user-1');
  });

  it('persists the owner marker alongside the cache it describes', () => {
    const client = restoredCache('user-1');
    const owner = client.getQueryCache().find({ queryKey: cacheOwnerKey });

    expect(owner && shouldDehydrateQuery(owner)).toBe(true);
  });
});
