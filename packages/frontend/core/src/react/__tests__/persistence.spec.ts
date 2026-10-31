import { type Query, QueryClient, type QueryKey, type QueryState } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';
import { authKeys } from '../auth.queries';

/** A product query key: a feature nobody listed, which stays out of storage. */
const organizationsList = ['organizations', 'list'] as const;
/** A kernel feature that is listed: the flags the console renders with on a cold start. */
const flags = ['featureFlags', 'evaluated', { anonymous: true }] as const;

import { PERSIST_META } from '../persist-meta';
import {
  cacheOwnerKey,
  createQueryPersistOptions,
  defaultQueryClientOptions,
  QUERY_PERSIST_MAX_AGE,
  reconcileCacheOwner,
  shouldDehydrateQuery,
} from '../persistence';
import { usersKeys } from '../users.queries';

/** A real `Query` in the given state — dehydration reads `state` and `queryKey`. */
function query(
  queryKey: QueryKey,
  status: QueryState['status'] = 'success',
  meta?: Record<string, unknown>,
): Query {
  const client = new QueryClient();
  const q = client.getQueryCache().build(client, { queryKey, meta });

  if (status === 'success') q.setState({ status: 'success', data: { ok: true } });
  if (status === 'error') q.setState({ status: 'error', error: new Error('boom') });

  return q;
}

describe('shouldDehydrateQuery', () => {
  it("persists the kernel's plain-data features", () => {
    expect(shouldDehydrateQuery(query(flags))).toBe(true);
    expect(shouldDehydrateQuery(query(['capabilities', 'deployment']))).toBe(true);
  });

  // The regression an allow-list prevents: a feature nobody listed used to be
  // stored, and an entity restored from storage is plain JSON. The workspace
  // list came back with `createdAt` a string, and a session's Intl formatter
  // throws "Invalid time value" on one.
  it('keeps a feature nobody listed out of storage', () => {
    expect(shouldDehydrateQuery(query(organizationsList))).toBe(false);
    expect(shouldDehydrateQuery(query(['profile', 'me']))).toBe(false);
  });

  it('persists a product feature the app lists', () => {
    expect(shouldDehydrateQuery(query(['permissions', 'catalog']), ['permissions'])).toBe(true);
    expect(shouldDehydrateQuery(query(organizationsList), ['permissions'])).toBe(false);
  });

  it('never persists the auth session or credential data', () => {
    expect(shouldDehydrateQuery(query(authKeys.session()))).toBe(false);
  });

  // The record names the person: their email and name stay out of storage,
  // while the permissions the nav reads on a warm start opt in.
  it('keeps the signed-in user out of storage but not their permissions', () => {
    expect(shouldDehydrateQuery(query(usersKeys.me()))).toBe(false);
    expect(shouldDehydrateQuery(query(usersKeys.permissions(), 'success', PERSIST_META))).toBe(
      true,
    );
  });

  it('only persists successful queries', () => {
    expect(shouldDehydrateQuery(query(flags, 'error'))).toBe(false);
    expect(shouldDehydrateQuery(query(flags, 'pending'))).toBe(false);
  });

  it('ignores keys that do not start with a feature string', () => {
    expect(shouldDehydrateQuery(query([{ scope: 'users' }]))).toBe(false);
  });
});

describe('createQueryPersistOptions', () => {
  it('caps restored entries at the persist window and busts on version', () => {
    const options = createQueryPersistOptions('1.2.3');

    expect(options.maxAge).toBe(QUERY_PERSIST_MAX_AGE);
    expect(options.buster).toBe('1.2.3:5');
    const { shouldDehydrateQuery: dehydrate } = options.dehydrateOptions;
    expect(dehydrate(query(authKeys.session()))).toBe(false);
    expect(dehydrate(query(flags))).toBe(true);
    expect(dehydrate(query(['permissions', 'catalog']))).toBe(false);
    const named = createQueryPersistOptions('1.2.3', { persistedFeatures: ['permissions'] });
    expect(named.dehydrateOptions.shouldDehydrateQuery(query(['permissions', 'catalog']))).toBe(
      true,
    );
  });

  it('keeps queries alive at least as long as they are persisted', () => {
    expect(defaultQueryClientOptions(0).queries.gcTime).toBeGreaterThanOrEqual(
      QUERY_PERSIST_MAX_AGE,
    );
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
