import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from './run-migrations';

describe('Auth (integration)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let dataSource: DataSource;
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

    // The real migration chain, not `synchronize`: sign-up's side effects need
    // the system roles the migrations seed, and the personal workspace is
    // granted the `owner` row one of them writes.
    await runAllMigrations();

    // Import AppModule (and therefore the Better Auth instance, which reads the
    // database config at module load) only after the container env vars are set.
    const { AppModule } = await import('../src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false });

    // Mirror `main.ts`: the prefix, URI versioning and the pipes are part of
    // the pipeline a request goes through, and one of the tests below is about
    // which of them answers first.
    const { VersioningType } = await import('@nestjs/common');
    const { SanitizePipe } = await import('@oppenheimer/backend-core');
    const { ZodValidationPipe } = await import('nestjs-zod');

    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new SanitizePipe(), new ZodValidationPipe());

    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    dataSource = moduleRef.get(DataSource);
  }, 180000);

  afterAll(async () => {
    await app?.close();
    // Better Auth's email queue is a module singleton outside the DI container,
    // so `app.close()` does not reach it. Close it before the containers go
    // away, or its in-flight ioredis commands reject into nothing.
    const { emailQueue } = await import('../src/auth/infrastructure/email-queue.util');
    await emailQueue.close().catch(() => {});
    await Promise.all([pgContainer?.stop(), redisContainer?.stop()]);
  });

  it('should be defined', () => {
    expect(app).toBeDefined();
  });

  describe('the session sign-up returns', () => {
    /**
     * Sign-up provisions the personal workspace, and the session it hands back
     * has to be able to work in it.
     *
     * Better Auth chooses a session's organization when the row is written, and
     * the hook that provisions the workspace is queued until after the sign-up
     * transaction commits — so the session row is written while the account
     * still belongs nowhere. An org-scoped role grant only reaches a caller's
     * ability while their session names the organization it was granted in, so
     * a session left with `activeOrganizationId = null` holds nothing but the
     * global `user` role: every org-scoped route answered 403, for a week, to
     * the workspace's own owner. Provisioning points the account's org-less
     * sessions at the new workspace in the same transaction.
     */
    it('is already in the workspace sign-up provisioned', async () => {
      const email = `signup-${randomUUID()}@example.com`;
      const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'Integration-test-password-1',
          name: 'New Account',
          firstName: 'New',
          lastName: 'Account',
        }),
      });

      expect(response.ok).toBe(true);
      const sessionToken = response.headers.get('set-auth-token');
      expect(sessionToken).toBeTruthy();
      const { user } = (await response.json()) as { user: { id: string } };

      const [membership] = await dataSource.query(
        `SELECT "organizationId" FROM "member" WHERE "userId" = $1`,
        [user.id],
      );
      expect(membership?.organizationId).toBeTruthy();

      const sessions = await dataSource.query(
        `SELECT "activeOrganizationId" FROM "session" WHERE "userId" = $1`,
        [user.id],
      );
      expect(sessions).toHaveLength(1);
      expect(sessions[0].activeOrganizationId).toBe(membership.organizationId);

      // And the consequence, through the guards: an org-scoped route answers
      // about the resource rather than refusing the caller.
      const probe = await fetch(`${baseUrl}/api/v1/sessions/${randomUUID()}`, {
        headers: { accept: 'application/json', authorization: `Bearer ${sessionToken}` },
      });
      expect(probe.status).toBe(404);
      expect(((await probe.json()) as { code?: string }).code).toBe('SESSIONS_001');
    });
  });
});
