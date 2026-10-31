import { randomBytes } from 'node:crypto';
import Redis from 'ioredis';
import { Client } from 'pg';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import type { TestProject } from 'vitest/node';
import type { IntegrationServices } from './integration-services';
import { runAllMigrations } from './run-migrations';

/**
 * One Postgres and one Redis for the whole integration run, instead of a pair
 * per spec file: the schema is migrated once, into a template database, and
 * each file copies it (`integration-services.ts`). The containers are started
 * here unless `DB_HOST` and `REDIS_HOST` already point at a pair, as the
 * stack's or a workflow's service containers do; on a pair we did not start,
 * only the databases and Redis keys this run created are removed afterwards.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const runId = `it_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
  const started: StartedTestContainer[] = [];

  const reuse = Boolean(process.env.DB_HOST && process.env.REDIS_HOST);
  let postgres: IntegrationServices['postgres'];
  let redis: IntegrationServices['redis'];

  if (reuse) {
    postgres = {
      host: process.env.DB_HOST as string,
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? '',
    };
    redis = {
      host: process.env.REDIS_HOST as string,
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
    };
  } else {
    const [pg, rd] = await Promise.all([
      new GenericContainer('postgres:16-alpine')
        .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
        // Thirty-odd files each hold an app pool, an auth pool and a client of
        // their own at once; the default 100 connections is not enough.
        .withCommand(['postgres', '-c', 'max_connections=1000'])
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start(),
      new GenericContainer('redis:7-alpine').withExposedPorts(6379).start(),
    ]);
    started.push(pg, rd);
    postgres = {
      host: pg.getHost(),
      port: pg.getMappedPort(5432),
      username: 'test',
      password: 'test',
    };
    redis = { host: rd.getHost(), port: rd.getMappedPort(6379) };
  }

  const template = `${runId}_template`;
  const services: IntegrationServices = { runId, template, postgres, redis };

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

  project.provide('integrationServices', services);

  return async () => {
    if (started.length > 0) {
      await Promise.all(started.map((container) => container.stop()));
      return;
    }
    // Someone else's pair: leave it as we found it.
    const cleanup = await adminClient(postgres);
    try {
      const { rows } = await cleanup.query<{ datname: string }>(
        'SELECT datname FROM pg_database WHERE starts_with(datname, $1)',
        [`${runId}_`],
      );
      for (const { datname } of rows) {
        await cleanup.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
      }
    } finally {
      await cleanup.end();
    }
    const client = new Redis({ ...redis, lazyConnect: true });
    try {
      await client.connect();
      const claimed = (await client.smembers(`${runId}:dbs`)).map(Number);
      for (const db of claimed) {
        await client.select(db);
        await client.flushdb();
      }
      await client.select(0);
      await client.del(`${runId}:next-db`, `${runId}:dbs`);
    } finally {
      client.disconnect();
    }
  };
}

async function adminClient(postgres: IntegrationServices['postgres']): Promise<Client> {
  const client = new Client({
    host: postgres.host,
    port: postgres.port,
    user: postgres.username,
    password: postgres.password,
    database: 'postgres',
  });
  await client.connect();
  return client;
}
