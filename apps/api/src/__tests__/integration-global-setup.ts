import { randomBytes } from 'node:crypto';
import Redis from 'ioredis';
import { GenericContainer, Wait } from 'testcontainers';
import type { TestProject } from 'vitest/node';
import { adminClient, type IntegrationServices, releaseRedisDbs } from './integration-servers';
import { runAllMigrations } from './run-migrations';

/**
 * One Postgres and one Redis for the whole integration run, instead of a pair
 * per spec file: the schema is migrated once, into a template database, and
 * each file copies it (`integration-services.ts`). The containers are started
 * here unless `DB_HOST` and `REDIS_HOST` already point at a pair, as the
 * stack's or a workflow's service containers do; on a pair we did not start,
 * only the databases and Redis dbs this run created are removed afterwards.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const { services, teardown } = await provisionIntegrationServices({
    start: process.env.DB_HOST && process.env.REDIS_HOST ? reuseServers : startServers,
    migrate: migrateTemplate,
  });
  project.provide('integrationServices', services);
  return teardown;
}

/** The pair a run uses, and how to leave it as the run found it. */
export interface StartedServers {
  postgres: IntegrationServices['postgres'];
  redis: IntegrationServices['redis'];
  /** Stops what was started, or on a pair someone else runs, removes what `runId` made. */
  release: (runId: string) => Promise<void>;
}

/**
 * Starts (or finds) the servers, then migrates the template. Whatever fails
 * after the servers are up releases them before the error propagates: the
 * teardown is never returned then, and `ci:local` runs without Ryuk, so
 * nothing else would stop them.
 */
export async function provisionIntegrationServices(steps: {
  start: () => Promise<StartedServers>;
  migrate: (services: IntegrationServices) => Promise<void>;
}): Promise<{ services: IntegrationServices; teardown: () => Promise<void> }> {
  const runId = `it_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
  const servers = await steps.start();
  const services: IntegrationServices = {
    runId,
    template: `${runId}_template`,
    postgres: servers.postgres,
    redis: servers.redis,
  };
  try {
    await steps.migrate(services);
  } catch (error) {
    await servers.release(runId).catch(() => {});
    throw error;
  }
  return { services, teardown: () => servers.release(runId) };
}

async function startServers(): Promise<StartedServers> {
  const started = await Promise.allSettled([
    new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      // Thirty-odd files each hold an app pool, an auth pool and a client of
      // their own at once; the default 100 connections is not enough.
      .withCommand(['postgres', '-c', 'max_connections=1000'])
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start(),
    // A logical db per Redis-using file, more than a default server's 16.
    new GenericContainer('redis:7-alpine')
      .withCommand(['redis-server', '--databases', '64'])
      .withExposedPorts(6379)
      .start(),
  ]);
  const containers = started.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  const stop = async () => {
    await Promise.all(containers.map((container) => container.stop()));
  };
  const [pg, rd] = started;
  if (pg.status === 'rejected' || rd.status === 'rejected') {
    await stop().catch(() => {});
    throw pg.status === 'rejected' ? pg.reason : (rd as PromiseRejectedResult).reason;
  }
  return {
    postgres: {
      host: pg.value.getHost(),
      port: pg.value.getMappedPort(5432),
      username: 'test',
      password: 'test',
    },
    redis: { host: rd.value.getHost(), port: rd.value.getMappedPort(6379) },
    release: stop,
  };
}

async function reuseServers(): Promise<StartedServers> {
  const postgres = {
    host: process.env.DB_HOST as string,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
  };
  const redis = {
    host: process.env.REDIS_HOST as string,
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  };
  return {
    postgres,
    redis,
    // Someone else's pair: leave it as we found it.
    release: async (runId) => {
      const admin = await adminClient(postgres);
      try {
        const { rows } = await admin.query<{ datname: string }>(
          'SELECT datname FROM pg_database WHERE starts_with(datname, $1)',
          [`${runId}_`],
        );
        for (const { datname } of rows) {
          await admin.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
        }
      } finally {
        await admin.end();
      }
      const client = new Redis({ ...redis, lazyConnect: true });
      try {
        await client.connect();
        await releaseRedisDbs(client, runId);
      } finally {
        client.disconnect();
      }
    },
  };
}

async function migrateTemplate({ template, postgres }: IntegrationServices): Promise<void> {
  const admin = await adminClient(postgres);
  try {
    await admin.query(`CREATE DATABASE "${template}"`);
  } finally {
    await admin.end();
  }
  // `runAllMigrations` reads where to migrate from the environment, as it did
  // when each file called it; this process runs no spec, so nothing else reads it.
  Object.assign(process.env, {
    DB_HOST: postgres.host,
    DB_PORT: String(postgres.port),
    DB_USERNAME: postgres.username,
    DB_PASSWORD: postgres.password,
    DB_DATABASE: template,
  });
  await runAllMigrations();
  const locker = await adminClient(postgres);
  try {
    // A template copied while someone is connected to it fails the copy.
    await locker.query(`ALTER DATABASE "${template}" WITH ALLOW_CONNECTIONS false`);
  } finally {
    await locker.end();
  }
}
