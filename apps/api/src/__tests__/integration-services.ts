import { randomBytes } from 'node:crypto';
import Redis from 'ioredis';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { inject } from 'vitest';
import { adminClient, claimRedisDb, type IntegrationServices } from './integration-servers';

declare module 'vitest' {
  export interface ProvidedContext {
    integrationServices: IntegrationServices;
  }
}

export interface TestDatabase {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  /** `postgres://…` for a bare `DataSource`. */
  url: string;
}

/**
 * A database of the file's own on the run's shared Postgres: a copy of the
 * migrated template, or with `empty`, a database with no schema at all, for a
 * spec whose subject is the migrations themselves. Files never share one, so
 * they keep the isolation a container each gave them and still run in
 * parallel workers.
 */
export async function createTestDatabase(options: { empty?: boolean } = {}): Promise<TestDatabase> {
  const { runId, template, postgres } = inject('integrationServices');
  const database = `${runId}_${randomBytes(6).toString('hex')}`;
  const admin = await adminClient(postgres);
  try {
    await admin.query(
      `CREATE DATABASE "${database}" TEMPLATE "${options.empty ? 'template0' : template}"`,
    );
  } finally {
    await admin.end();
  }
  const { host, port, username, password } = postgres;
  return {
    host,
    port,
    username,
    password,
    database,
    url: `postgres://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`,
  };
}

/**
 * `createTestDatabase`, with `DB_*` pointing at it, for a spec that builds the
 * app or reads the database config from the environment.
 */
export async function useTestDatabase(): Promise<TestDatabase> {
  const db = await createTestDatabase();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_HOST: db.host,
    DB_PORT: String(db.port),
    DB_USERNAME: db.username,
    DB_PASSWORD: db.password,
    DB_DATABASE: db.database,
  });
  return db;
}

/**
 * A logical Redis database of the file's own on the run's shared Redis, with
 * `REDIS_*` pointing at it: BullMQ queues, the cache and Better Auth's session
 * store of one file never see another's keys. Pub/sub channels and
 * `CLIENT PAUSE` are server-wide; a spec that stalls Redis takes
 * `usePrivateRedis` instead.
 */
export async function useTestRedis(): Promise<void> {
  const { runId, redis } = inject('integrationServices');
  const client = new Redis({ ...redis, lazyConnect: true });
  try {
    await client.connect();
    pointRedisAt({ ...redis, db: await claimRedisDb(client, runId) });
  } finally {
    client.disconnect();
  }
}

/**
 * A Redis server of the file's own, with `REDIS_*` pointing at it, for a spec
 * that does something server-wide (`CLIENT PAUSE`). The caller stops it.
 */
export async function usePrivateRedis(): Promise<StartedTestContainer> {
  const container = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
  pointRedisAt({ host: container.getHost(), port: container.getMappedPort(6379), db: 0 });
  return container;
}

function pointRedisAt(redis: { host: string; port: number; password?: string; db: number }) {
  Object.assign(process.env, {
    REDIS_HOST: redis.host,
    REDIS_PORT: String(redis.port),
    REDIS_DB: String(redis.db),
  });
  if (redis.password) process.env.REDIS_PASSWORD = redis.password;
  else delete process.env.REDIS_PASSWORD;
}
