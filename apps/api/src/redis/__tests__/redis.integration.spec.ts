import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CacheService } from '@oppenheimer/backend-cache';
import type Redis from 'ioredis';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { runAllMigrations } from '../../__tests__/run-migrations';
import { RedisHealthIndicator } from '../../health/infrastructure/redis-health.adapter';
import { LEGACY_REPLAY_MARKER } from '../../hosts/hosts.di-tokens';
import type { LegacyReplayMarkerPort } from '../../hosts/infrastructure/legacy-replay-marker.port';
import { RedisThrottlerStorage } from '../../throttling/infrastructure/redis-throttler.adapter';
import { REDIS_CLIENT } from '../redis.di-tokens';

/**
 * The shared Redis connection, against a real Redis: the cache, the rate
 * limiter and the health probe run on one client, each keeps to its own
 * keyspace, and the client is gone once the app closes.
 */
describe('Redis (integration)', () => {
  let app: INestApplication;
  let redis: Redis;
  let pgContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;

  beforeAll(async () => {
    [pgContainer, redisContainer] = await Promise.all([
      new GenericContainer('postgres:16-alpine')
        .withEnvironment({
          POSTGRES_USER: 'test',
          POSTGRES_PASSWORD: 'test',
          POSTGRES_DB: 'test',
        })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start(),
      new GenericContainer('redis:7-alpine').withExposedPorts(6379).start(),
    ]);

    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = pgContainer.getHost();
    process.env.DB_PORT = pgContainer.getMappedPort(5432).toString();
    process.env.DB_USERNAME = 'test';
    process.env.DB_PASSWORD = 'test';
    process.env.DB_DATABASE = 'test';
    process.env.REDIS_HOST = redisContainer.getHost();
    process.env.REDIS_PORT = redisContainer.getMappedPort(6379).toString();
    process.env.BETTER_AUTH_SECRET = 'integration-test-secret-value-32-chars';

    await runAllMigrations();

    // After the env vars: Better Auth and its email queue read them at load.
    const { AppModule } = await import('../../app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    await app.init();

    redis = app.get<Redis>(REDIS_CLIENT);
    // The client connects eagerly; wait for it rather than for a first command
    // to be refused by the fail-fast settings.
    if (redis.status !== 'ready') {
      await new Promise((resolve) => redis.once('ready', resolve));
    }
  }, 180000);

  afterAll(async () => {
    await app?.close();
    const { emailQueue } = await import('../../auth/infrastructure/email-queue.util');
    await emailQueue.close().catch(() => {});
    await Promise.all([pgContainer?.stop(), redisContainer?.stop()]);
  });

  it('writes every cache key under the cache: prefix', async () => {
    const cache = app.get(CacheService);

    await cache.set('attach:integration', { sessionId: 's-1' }, 60);

    expect(await redis.keys('cache:attach:*')).toEqual(['cache:attach:integration']);
    expect(await redis.exists('attach:integration')).toBe(0);
    await expect(cache.take('attach:integration')).resolves.toEqual({ sessionId: 's-1' });
  });

  it('reads many keys in one MGET and loads a miss once', async () => {
    const cache = app.get(CacheService);
    await cache.set('mget:a', 'A', 60);

    await expect(cache.mget(['mget:a', 'mget:missing'])).resolves.toEqual(['A', undefined]);

    let loads = 0;
    const load = async () => {
      loads += 1;
      return ['oppenheimer'];
    };
    const [first, second] = await Promise.all([
      cache.getOrSet('github:repositories:integration', 60, load),
      cache.getOrSet('github:repositories:integration', 60, load),
    ]);

    expect([first, second]).toEqual([['oppenheimer'], ['oppenheimer']]);
    expect(loads).toBe(1);
    expect(await redis.ttl('cache:github:repositories:integration')).toBeGreaterThan(0);
  });

  it('counts rate-limit hits by script hash, outside the cache namespace', async () => {
    const storage = app.get(RedisThrottlerStorage);

    await storage.increment('ip:10.0.0.1', 60_000, 1, 60_000, 'integration');
    const second = await storage.increment('ip:10.0.0.1', 60_000, 1, 60_000, 'integration');

    expect(second).toMatchObject({ totalHits: 2, isBlocked: true });
    expect(await redis.exists('throttle:integration:ip:10.0.0.1')).toBe(1);
    // `defineCommand` loaded the script; a restarted Redis would answer NOSCRIPT
    // and ioredis would fall back to EVAL on its own.
    const [cached] = (await redis.script('EXISTS', sha1OfLoadedScript(redis))) as number[];
    expect(cached).toBe(1);
  });

  // TODO(remove after #162 has been live once): with `LegacyReplayMarkerPort`.
  it('finds a host-assertion marker burned before the cache: prefix, and only that one', async () => {
    const markers = app.get<LegacyReplayMarkerPort>(LEGACY_REPLAY_MARKER, { strict: false });
    const cache = app.get(CacheService);

    // Burned by the new code: under the prefix, which the legacy check ignores.
    await cache.setIfAbsent('host-assertion:jti:host-1:new-jti', 'x', 60);
    await expect(markers.isBurned('host-1', 'new-jti')).resolves.toBe(false);

    // Burned by a replica that ran before the prefix: the raw key.
    await redis.set('host-assertion:jti:host-1:old-jti', '"x"', 'EX', 60);
    await expect(markers.isBurned('host-1', 'old-jti')).resolves.toBe(true);
    await expect(markers.isBurned('host-2', 'old-jti')).resolves.toBe(false);
  });

  it('reports Redis healthy through the shared client', async () => {
    await expect(app.get(RedisHealthIndicator).isHealthy('redis')).resolves.toEqual({
      redis: { status: 'up' },
    });
  });

  it('closes the shared client with the app', async () => {
    const { Test: NestTest } = await import('@nestjs/testing');
    const { AppModule } = await import('../../app.module');
    const moduleRef = await NestTest.createTestingModule({ imports: [AppModule] }).compile();
    const second = moduleRef.createNestApplication({ bodyParser: false });
    await second.init();
    const client = second.get<Redis>(REDIS_CLIENT);
    // `quit` resolves on Redis's reply; the socket closes just after it.
    const ended = new Promise<void>((resolve) => client.once('end', () => resolve()));

    await second.close();
    await ended;

    expect(client.status).toBe('end');
  }, 60000);
});

/** The SHA ioredis registered for the throttler's command (`defineCommand` keeps it). */
function sha1OfLoadedScript(redis: Redis): string {
  const scripts = (redis as unknown as { scriptsSet: Record<string, { sha: string }> }).scriptsSet;
  return scripts.throttleIncrement.sha;
}
