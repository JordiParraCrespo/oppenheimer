import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerException } from '@nestjs/throttler';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { runAllMigrations } from './run-migrations';

/**
 * Guards run before interceptors, so while the correlation id was opened in an
 * interceptor, every 401/403/429 a guard threw went out with no
 * `correlationId`: exactly the answers people report. The id is now opened in
 * middleware and echoed as `x-correlation-id`; these go through the whole
 * pipeline to prove a guard's refusal carries it.
 */
describe('Correlation id (integration)', () => {
  let app: INestApplication;
  let baseUrl: string;
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

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });

    const { VersioningType } = await import('@nestjs/common');
    const { SanitizePipe } = await import('@oppenheimer/backend-core');
    const { ZodValidationPipe } = await import('nestjs-zod');
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new SanitizePipe(), new ZodValidationPipe());

    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  }, 180000);

  afterAll(async () => {
    await app?.close();
    const { emailQueue } = await import('../src/auth/infrastructure/email-queue.util');
    await emailQueue.close().catch(() => {});
    await Promise.all([pgContainer?.stop(), redisContainer?.stop()]);
  });

  async function problemOf(response: Response) {
    return (await response.json()) as { status: number; code?: string; correlationId?: string };
  }

  it('puts the id on a 401 from the auth guard, matching the response header', async () => {
    const response = await fetch(`${baseUrl}/api/v1/users/me`, {
      headers: { accept: 'application/json', authorization: 'Bearer not-a-real-token' },
    });

    expect(response.status).toBe(401);
    const header = response.headers.get('x-correlation-id');
    expect(header).toBeTruthy();
    expect((await problemOf(response)).correlationId).toBe(header);
  });

  it('honours a valid client id and replaces an invalid one', async () => {
    const honoured = await fetch(`${baseUrl}/api/v1/users/me`, {
      headers: { 'x-correlation-id': 'support-ticket-42' },
    });
    expect(honoured.headers.get('x-correlation-id')).toBe('support-ticket-42');
    expect((await problemOf(honoured)).correlationId).toBe('support-ticket-42');

    const oversized = 'a'.repeat(4096);
    const replaced = await fetch(`${baseUrl}/api/v1/users/me`, {
      headers: { 'x-correlation-id': oversized },
    });
    const replacedId = replaced.headers.get('x-correlation-id');
    expect(replacedId).toMatch(/^[0-9a-f-]{36}$/);
    expect((await problemOf(replaced)).correlationId).toBe(replacedId);
  });

  it('puts the id on a 403 from the policies guard', async () => {
    const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: `cid-${randomUUID()}@example.com`,
        password: 'Integration-test-password-1',
        name: 'Plain User',
        firstName: 'Plain',
        lastName: 'User',
      }),
    });
    expect(response.ok).toBe(true);
    // The Better Auth routes share pino's options, so they echo an id too.
    expect(response.headers.get('x-correlation-id')).toBeTruthy();
    const token = response.headers.get('set-auth-token');

    // A plain account does not manage the user directory.
    const refused = await fetch(`${baseUrl}/api/v1/users`, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    });

    expect(refused.status).toBe(403);
    const header = refused.headers.get('x-correlation-id');
    expect(header).toBeTruthy();
    expect((await problemOf(refused)).correlationId).toBe(header);
  });

  it('puts the id on a 429 from the throttler guard', async () => {
    const { CredentialThrottlerGuard } = await import(
      '../src/throttling/guards/credential-throttler.guard'
    );
    // Throttling is skipped under test; the refusal itself is what matters.
    const refuse = vi
      .spyOn(CredentialThrottlerGuard.prototype, 'canActivate')
      .mockRejectedValueOnce(new ThrottlerException());

    const response = await fetch(`${baseUrl}/api/v1/users/me`, {
      headers: { 'x-correlation-id': 'throttled-1' },
    });
    refuse.mockRestore();

    expect(response.status).toBe(429);
    expect((await problemOf(response)).correlationId).toBe('throttled-1');
  });
});
