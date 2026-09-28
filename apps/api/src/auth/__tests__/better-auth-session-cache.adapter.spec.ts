import type Redis from 'ioredis';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const findUserById = vi.fn();
const deleteSessions = vi.fn();
const findMany = vi.fn();

vi.mock('../infrastructure/better-auth.config', () => ({
  auth: {
    get $context() {
      return Promise.resolve({
        internalAdapter: { findUserById, deleteSessions },
        adapter: { findMany },
      });
    },
  },
}));

import {
  bindSessionStore,
  sessionStoreKey,
} from '../infrastructure/better-auth-secondary-storage.adapter';
import { BetterAuthSessionCacheAdapter } from '../infrastructure/better-auth-session-cache.adapter';

const HOUR = 60 * 60 * 1000;

/** A Redis stand-in keyed as the store keys it. */
function fakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
  };
}

const row = (token: string, overrides: Record<string, unknown> = {}) => ({
  id: `id-${token}`,
  token,
  userId: 'user-1',
  activeOrganizationId: 'org-new',
  expiresAt: new Date(Date.now() + HOUR),
  ...overrides,
});

describe('BetterAuthSessionCacheAdapter', () => {
  let redis: ReturnType<typeof fakeRedis>;
  let binding: { onModuleDestroy(): void };
  const adapter = new BetterAuthSessionCacheAdapter();

  const cache = (token: string, value: unknown) =>
    redis.store.set(sessionStoreKey(token), JSON.stringify(value));
  const cached = (token: string) => {
    const raw = redis.store.get(sessionStoreKey(token));
    return raw ? JSON.parse(raw) : undefined;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    redis = fakeRedis();
    binding = bindSessionStore(redis as unknown as Redis);
    findUserById.mockResolvedValue({ id: 'user-1', name: 'New Name', isActive: false });
    findMany.mockResolvedValue([row('cached'), row('uncached')]);
  });

  afterEach(() => binding.onModuleDestroy());

  describe('refreshUser', () => {
    it('rewrites each cached session from the database rows and the user', async () => {
      cache('cached', {
        session: row('cached', { activeOrganizationId: 'org-old' }),
        user: { id: 'user-1', name: 'Old Name', isActive: true },
      });

      await adapter.refreshUser('user-1');

      expect(cached('cached')).toMatchObject({
        session: { token: 'cached', activeOrganizationId: 'org-new' },
        user: { name: 'New Name', isActive: false },
      });
      // A TTL that runs out with the session.
      const [, , ex, ttl] = redis.set.mock.calls[0] as unknown[];
      expect(ex).toBe('EX');
      expect(ttl).toBeGreaterThan(3500);
      expect(ttl).toBeLessThanOrEqual(3600);
    });

    it('leaves a session with no cached copy alone: it already answers from the database', async () => {
      await adapter.refreshUser('user-1');

      expect(cached('uncached')).toBeUndefined();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('evicts a copy it cannot rewrite rather than leave it stale', async () => {
      cache('cached', { session: row('cached'), user: { id: 'user-1' } });
      redis.set.mockRejectedValueOnce(new Error('OOM'));

      await adapter.refreshUser('user-1');

      expect(cached('cached')).toBeUndefined();
    });

    it('fails loudly when Redis can do neither', async () => {
      cache('cached', { session: row('cached'), user: { id: 'user-1' } });
      redis.set.mockRejectedValueOnce(new Error('down'));
      redis.del.mockRejectedValueOnce(new Error('down'));

      await expect(adapter.refreshUser('user-1')).rejects.toThrow('down');
    });

    it('evicts every copy when the user no longer exists', async () => {
      findUserById.mockResolvedValue(null);
      cache('cached', { session: row('cached'), user: { id: 'user-1' } });

      await adapter.refreshUser('user-1');

      expect(cached('cached')).toBeUndefined();
    });
  });

  describe('evictUser', () => {
    it('drops the copies of the rows and of everything Better Auth indexed, not the rows', async () => {
      cache('cached', { session: row('cached') });
      cache('signed-in-since', { session: row('signed-in-since') });
      redis.store.set(
        sessionStoreKey('active-sessions-user-1'),
        JSON.stringify([{ token: 'signed-in-since', expiresAt: Date.now() + HOUR }]),
      );

      await adapter.evictUser('user-1');

      expect(cached('cached')).toBeUndefined();
      expect(cached('signed-in-since')).toBeUndefined();
      expect(redis.store.size).toBe(0);
      expect(deleteSessions).not.toHaveBeenCalled();
    });

    it('fails loudly when a copy cannot be dropped', async () => {
      redis.del.mockRejectedValue(new Error('down'));

      await expect(adapter.evictUser('user-1')).rejects.toThrow('down');
    });
  });

  describe('revokeOtherSessions', () => {
    it('revokes every session in the database but the current one', async () => {
      findMany.mockResolvedValue([row('current'), row('legacy'), row('other')]);

      await adapter.revokeOtherSessions('user-1', 'id-current');

      expect(deleteSessions).toHaveBeenCalledWith(['legacy', 'other']);
    });

    it('asks nothing of Better Auth when there are no others', async () => {
      findMany.mockResolvedValue([row('current')]);

      await adapter.revokeOtherSessions('user-1', 'id-current');

      expect(deleteSessions).not.toHaveBeenCalled();
    });
  });
});
