import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { useTestDatabase, useTestRedis } from '../../__tests__/integration-services';

/**
 * Better Auth's own rate limit, the only one in front of `/api/auth/*`, through
 * the real application: the handler `AppModule` mounts, the middleware it is
 * wrapped in and the `rateLimit` table the counters land in. It used to key on
 * `X-Forwarded-For` as the client sent it, so a new header per request opened
 * a new bucket and password guesses were unlimited. With `TRUST_PROXY=0` (no
 * `trust proxy`, as here) the bucket is the socket's address. How the address
 * is derived for other hop counts is `auth-client-ip.util.spec.ts`.
 */
describe('Better Auth rate limit (integration)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let dataSource: DataSource;

  beforeAll(async () => {
    await useTestDatabase();
    await useTestRedis();
    process.env.BETTER_AUTH_SECRET = 'integration-test-secret-value-32-chars';
    // Off under NODE_ENV=test unless asked for; read when Better Auth's
    // configuration is imported, so set before the import below.
    vi.stubEnv('AUTH_RATE_LIMIT_ENABLED', 'true');

    const { AppModule } = await import('../../app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.setGlobalPrefix('api');
    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    dataSource = moduleRef.get(DataSource);
  }, 180000);

  afterAll(async () => {
    await app?.close();
    const { emailQueue } = await import('../infrastructure/email-queue.util');
    await emailQueue.close().catch(() => {});
  });

  const signInFrom = (forwardedFor: string) =>
    fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': forwardedFor },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'not-the-password-1' }),
    });

  it('with TRUST_PROXY=0, counts two sign-ins with different X-Forwarded-For in one bucket', async () => {
    await signInFrom('203.0.113.1');
    await signInFrom('203.0.113.2');

    const buckets: { key: string; count: number }[] = await dataSource.query(
      `SELECT "key", "count" FROM "rateLimit" WHERE "key" LIKE '%|/sign-in/email'`,
    );
    expect(buckets).toHaveLength(1);
    expect(buckets[0].key).not.toContain('203.0.113.');
    expect(buckets[0].count).toBe(2);
  });
});
