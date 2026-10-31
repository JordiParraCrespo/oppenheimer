import { randomBytes } from 'node:crypto';
import Redis from 'ioredis';
import { Client } from 'pg';
import { inject } from 'vitest';

/**
 * What `integration-global-setup.ts` started (or found) for the run, handed to
 * every spec file through `provide`/`inject`.
 */
export interface IntegrationServices {
  /** Prefix of every database and Redis key this run creates. */
  runId: string;
  /** The migrated database each file's own database is copied from. */
  template: string;
  postgres: { host: string; port: number; username: string; password: string };
  redis: { host: string; port: number; password?: string };
}

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

export interface TestRedis {
  host: string;
  port: number;
  password?: string;
  /** The logical database this file owns on the shared server. */
  db: number;
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
  const admin = new Client({
    host: postgres.host,
    port: postgres.port,
    user: postgres.username,
    password: postgres.password,
    database: 'postgres',
  });
  await admin.connect();
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
 * `CLIENT PAUSE` are server-wide, so a spec that stalls Redis starts a server
 * of its own instead.
 */
export async function useTestRedis(): Promise<TestRedis> {
  const { runId, redis } = inject('integrationServices');
  const client = new Redis({ ...redis, lazyConnect: true });
  await client.connect();
  try {
    const [, databases] = (await client.config('GET', 'databases')) as [string, string];
    // Skip a database someone else's data sits in: on a Redis we did not
    // start, 0 is the running stack's.
    for (;;) {
      const db = await client.incr(`${runId}:next-db`);
      if (db >= Number(databases)) {
        throw new Error(
          `No free Redis database left (${databases} on ${redis.host}:${redis.port}); ` +
            'give the server more with `--databases`',
        );
      }
      await client.select(db);
      const empty = (await client.dbsize()) === 0;
      await client.select(0);
      if (!empty) continue;
      await client.sadd(`${runId}:dbs`, String(db));
      Object.assign(process.env, {
        REDIS_HOST: redis.host,
        REDIS_PORT: String(redis.port),
        REDIS_DB: String(db),
      });
      if (redis.password) process.env.REDIS_PASSWORD = redis.password;
      return { ...redis, db };
    }
  } finally {
    client.disconnect();
  }
}
