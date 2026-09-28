import type Redis from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from './cache.service';
import { RedisCacheService } from './redis-cache.service';

/** The commands the service sends, recorded; each test sets the replies it needs. */
function fakeRedis() {
  return {
    get: vi.fn(),
    mget: vi.fn(),
    set: vi.fn(),
    getdel: vi.fn(),
    del: vi.fn(),
  };
}

let redis: ReturnType<typeof fakeRedis>;

function service(options?: { keyPrefix?: string }): RedisCacheService {
  return new RedisCacheService(redis as unknown as Redis, options);
}

/** A promise the test resolves or rejects when it chooses. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('RedisCacheService', () => {
  beforeEach(() => {
    redis = fakeRedis();
  });

  describe('key namespace', () => {
    // The cache shares its Redis database with BullMQ (`bull:*`) and the rate
    // limiter (`throttle:*`). Every command must land under the cache's own
    // prefix, while callers keep writing their unprefixed keys.
    it('prefixes every key with cache: by default', async () => {
      redis.set.mockResolvedValue('OK');
      redis.get.mockResolvedValue(null);
      redis.del.mockResolvedValue(1);

      const cache = service();
      await cache.set('a', 1);
      await cache.set('b', 'x', 60);
      await cache.get('a');
      await cache.del('a');

      expect(redis.set).toHaveBeenCalledWith('cache:a', '1');
      expect(redis.set).toHaveBeenCalledWith('cache:b', '"x"', 'EX', 60);
      expect(redis.get).toHaveBeenCalledWith('cache:a');
      expect(redis.del).toHaveBeenCalledWith('cache:a');
    });

    it('takes another prefix when given one', async () => {
      redis.get.mockResolvedValue(null);

      await service({ keyPrefix: 'test:' }).get('a');

      expect(redis.get).toHaveBeenCalledWith('test:a');
    });
  });

  describe('get', () => {
    it('parses what it finds and answers undefined for a missing key', async () => {
      redis.get.mockResolvedValueOnce('{"n":1}').mockResolvedValueOnce(null);

      await expect(service().get('a')).resolves.toEqual({ n: 1 });
      await expect(service().get('b')).resolves.toBeUndefined();
    });
  });

  describe('mget', () => {
    it('reads every key in one MGET, in order, with missing keys as undefined', async () => {
      redis.mget.mockResolvedValue([null, '"x"']);

      await expect(service().mget(['a', 'b'])).resolves.toEqual([undefined, 'x']);
      expect(redis.mget).toHaveBeenCalledTimes(1);
      expect(redis.mget).toHaveBeenCalledWith(['cache:a', 'cache:b']);
    });

    it('answers an empty list without a round trip', async () => {
      await expect(service().mget([])).resolves.toEqual([]);
      expect(redis.mget).not.toHaveBeenCalled();
    });
  });

  describe('setIfAbsent', () => {
    it('claims a free key in one atomic command', async () => {
      redis.set.mockResolvedValue('OK');

      await expect(service().setIfAbsent('jti:abc', 1, 300)).resolves.toBe(true);
      // NX is what decides the race, and EX is what stops the marker leaking:
      // both belong in the same command as the write.
      expect(redis.set).toHaveBeenCalledWith('cache:jti:abc', '1', 'EX', 300, 'NX');
    });

    it('reports a key someone else already claimed', async () => {
      // Redis answers `null` when NX refuses, which is the whole point: the
      // loser of the race learns it lost rather than overwriting the winner.
      redis.set.mockResolvedValue(null);

      await expect(service().setIfAbsent('jti:abc', 1, 300)).resolves.toBe(false);
    });

    it('has exactly one winner when two callers race', async () => {
      // The property the replay guard is built on, and the reason this is not
      // get-then-set: whichever call reaches Redis second is told so, rather than
      // both reading "absent" and both proceeding.
      const cache = service();
      let claimed = false;
      redis.set.mockImplementation(async () => {
        if (claimed) return null;
        claimed = true;
        return 'OK';
      });

      const results = await Promise.all([
        cache.setIfAbsent('jti:abc', 1, 300),
        cache.setIfAbsent('jti:abc', 1, 300),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
    });
  });

  describe('take', () => {
    it('reads and deletes in one command, so a ticket is redeemed once', async () => {
      redis.getdel.mockResolvedValue(JSON.stringify({ sessionId: 's-1' }));

      await expect(service().take('attach:abc')).resolves.toEqual({ sessionId: 's-1' });
      expect(redis.getdel).toHaveBeenCalledWith('cache:attach:abc');
    });

    it('answers undefined for a key that is gone', async () => {
      redis.getdel.mockResolvedValue(null);

      await expect(service().take('attach:abc')).resolves.toBeUndefined();
    });
  });

  describe('getOrSet', () => {
    it('runs the loader once for concurrent callers of one key', async () => {
      // The stampede: an entry expires while ten requests want it, and each of
      // them used to recompute it (for the repository picker, ten paginated
      // GitHub listings).
      redis.get.mockResolvedValue(null);
      redis.set.mockResolvedValue('OK');
      const gate = deferred<string[]>();
      const load = vi.fn(() => gate.promise);
      const cache = service();

      const callers = Array.from({ length: 10 }, () => cache.getOrSet('repos:1', 60, load));
      gate.resolve(['oppenheimer']);
      const results = await Promise.all(callers);

      expect(load).toHaveBeenCalledTimes(1);
      expect(results).toEqual(Array.from({ length: 10 }, () => ['oppenheimer']));
      expect(redis.set).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith('cache:repos:1', '["oppenheimer"]', 'EX', 60);
    });

    it('serves a hit without calling the loader', async () => {
      redis.get.mockResolvedValue('"cached"');
      const load = vi.fn(async () => 'fresh');

      await expect(service().getOrSet('k', 60, load)).resolves.toBe('cached');
      expect(load).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('hands a loader failure to every waiter, caches nothing, and retries next time', async () => {
      redis.get.mockResolvedValue(null);
      redis.set.mockResolvedValue('OK');
      const gate = deferred<string>();
      const load = vi.fn(() => gate.promise);
      const cache = service();

      const waiters = Promise.allSettled([
        cache.getOrSet('k', 60, load),
        cache.getOrSet('k', 60, load),
      ]);
      gate.reject(new Error('GitHub is down'));

      for (const outcome of await waiters) {
        expect(outcome).toMatchObject({
          status: 'rejected',
          reason: { message: 'GitHub is down' },
        });
      }
      expect(load).toHaveBeenCalledTimes(1);
      expect(redis.set).not.toHaveBeenCalled();

      await expect(cache.getOrSet('k', 60, async () => 'recovered')).resolves.toBe('recovered');
    });

    it('falls back to the loader when Redis cannot be read', async () => {
      redis.get.mockRejectedValue(new Error("Stream isn't writeable"));
      redis.set.mockRejectedValue(new Error("Stream isn't writeable"));

      await expect(service().getOrSet('k', 60, async () => 'fresh')).resolves.toBe('fresh');
    });

    it('does not fail the caller when the write is refused', async () => {
      redis.get.mockResolvedValue(null);
      redis.set.mockRejectedValue(new Error('Command timed out'));

      await expect(service().getOrSet('k', 60, async () => 'fresh')).resolves.toBe('fresh');
    });

    it('forgets the flight once it settles, so the next miss loads again', async () => {
      redis.get.mockResolvedValue(null);
      redis.set.mockResolvedValue('OK');
      const load = vi.fn(async () => 'v');
      const cache = service();

      await cache.getOrSet('k', 60, load);
      await cache.getOrSet('k', 60, load);

      expect(load).toHaveBeenCalledTimes(2);
      expect((cache as unknown as { inFlight: Map<string, unknown> }).inFlight.size).toBe(0);
    });

    it('keeps separate keys separate', async () => {
      redis.get.mockResolvedValue(null);
      redis.set.mockResolvedValue('OK');
      const cache = service();

      const [a, b] = await Promise.all([
        cache.getOrSet('a', 60, async () => 'A'),
        cache.getOrSet('b', 60, async () => 'B'),
      ]);

      expect([a, b]).toEqual(['A', 'B']);
    });
  });

  it('offers no way to flush the database it shares with the queues', () => {
    // `reset()` used to flush the whole database, the one BullMQ's jobs and the
    // rate-limit counters also live in.
    expect('reset' in service()).toBe(false);
    expect('reset' in CacheService.prototype).toBe(false);
  });
});
