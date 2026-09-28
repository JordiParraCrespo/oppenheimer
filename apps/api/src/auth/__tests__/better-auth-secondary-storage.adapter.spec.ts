import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  betterAuthSecondaryStorage,
  bindSessionStore,
  sessionStoreKey,
} from '../infrastructure/better-auth-secondary-storage.adapter';

const TOKEN = 'Xk3live-session-token-value';
const hashed = (key: string) => `ba:${createHash('sha256').update(key).digest('hex')}`;

function fakeRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  };
}

describe('Better Auth secondary storage', () => {
  let redis: ReturnType<typeof fakeRedis>;
  let binding: { onModuleDestroy(): void };

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    redis = fakeRedis();
    binding = bindSessionStore(redis as unknown as Redis);
  });

  afterEach(() => binding.onModuleDestroy());

  it('keys every entry by a SHA-256 digest under ba:, never the raw token', async () => {
    await betterAuthSecondaryStorage.set(TOKEN, '{}', 60);
    await betterAuthSecondaryStorage.get(TOKEN);
    await betterAuthSecondaryStorage.delete(TOKEN);

    const key = sessionStoreKey(TOKEN);
    expect(key).toBe(hashed(TOKEN));
    expect(key).toMatch(/^ba:[0-9a-f]{64}$/);
    for (const call of [
      ...redis.set.mock.calls,
      ...redis.get.mock.calls,
      ...redis.del.mock.calls,
    ]) {
      expect(call[0]).toBe(key);
      expect(call[0]).not.toContain(TOKEN);
    }
  });

  it('maps the TTL to EX, and stores without one when none is given', async () => {
    await betterAuthSecondaryStorage.set(TOKEN, 'value', 120);
    await betterAuthSecondaryStorage.set('active-sessions-user-1', 'list');

    expect(redis.set).toHaveBeenNthCalledWith(1, hashed(TOKEN), 'value', 'EX', 120);
    expect(redis.set).toHaveBeenNthCalledWith(2, hashed('active-sessions-user-1'), 'list');
  });

  it('answers a failed read as a miss, so Better Auth falls back to Postgres', async () => {
    redis.get.mockRejectedValue(new Error('Connection is closed'));

    await expect(betterAuthSecondaryStorage.get(TOKEN)).resolves.toBeNull();
  });

  it('swallows a failed write: the entry is only a copy', async () => {
    redis.set.mockRejectedValue(new Error('Connection is closed'));

    await expect(betterAuthSecondaryStorage.set(TOKEN, '{}', 60)).resolves.toBeUndefined();
  });

  it('propagates a failed delete, so a revocation cannot succeed silently', async () => {
    redis.del.mockRejectedValue(new Error('Connection is closed'));

    await expect(betterAuthSecondaryStorage.delete(TOKEN)).rejects.toThrow('Connection is closed');
  });

  it('leaves verification records to Postgres entirely', async () => {
    await betterAuthSecondaryStorage.set('verification:reset-password:abc', '{}', 60);
    await expect(betterAuthSecondaryStorage.get('verification:reset-password:abc')).resolves.toBe(
      null,
    );
    await betterAuthSecondaryStorage.delete('verification:reset-password:abc');

    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('is absent until bound, and after the binding is released', async () => {
    binding.onModuleDestroy();

    await expect(betterAuthSecondaryStorage.get(TOKEN)).resolves.toBeNull();
    await betterAuthSecondaryStorage.set(TOKEN, '{}', 60);
    await betterAuthSecondaryStorage.delete(TOKEN);

    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('keeps a newer binding when an older one is released', async () => {
    const newer = fakeRedis();
    const second = bindSessionStore(newer as unknown as Redis);

    binding.onModuleDestroy();
    await betterAuthSecondaryStorage.get(TOKEN);

    expect(newer.get).toHaveBeenCalled();
    second.onModuleDestroy();
  });
});
