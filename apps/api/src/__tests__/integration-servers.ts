import type Redis from 'ioredis';
import { Client } from 'pg';

/**
 * Where the integration run's one Postgres and one Redis are, and how a
 * database or a Redis db is claimed on them. Shared by the global setup, which
 * runs outside any test file, and `integration-services.ts`, which each file
 * calls; nothing here imports `vitest`, so both can load it.
 */
export interface IntegrationServices {
  /** Prefix of every database this run creates, and the owner of its Redis dbs. */
  runId: string;
  /** The migrated database each file's own database is copied from. */
  template: string;
  postgres: { host: string; port: number; username: string; password: string };
  redis: { host: string; port: number; password?: string };
}

/** A connection to the server's maintenance database, for `CREATE`/`DROP DATABASE`. */
export async function adminClient(postgres: IntegrationServices['postgres']): Promise<Client> {
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

/**
 * The reservation of logical db `db`, held in db 0. Server-wide, not per run:
 * two runs on one Redis must not both take a db because both saw it empty.
 */
const reservationKey = (db: number) => `oppenheimer:integration:redis-db:${db}`;

/** Outlives any run; bounds how long a run that died keeps its dbs. */
const RESERVATION_SECONDS = 6 * 60 * 60;

/** How many logical dbs the server has, from `CONFIG GET databases` (`['databases', '16']`). */
export function parseDatabasesReply(reply: unknown): number {
  if (Array.isArray(reply) && reply[0] === 'databases') {
    const count = Number(reply[1]);
    if (Number.isInteger(count) && count > 0) return count;
  }
  throw new Error(`Unexpected reply to CONFIG GET databases: ${JSON.stringify(reply)}`);
}

/**
 * Reserves the first logical db, from 1 (0 is a running stack's), that no run
 * holds and that has no keys, and answers its index. `client` stays on db 0.
 */
export async function claimRedisDb(client: Redis, runId: string): Promise<number> {
  const databases = parseDatabasesReply(await client.config('GET', 'databases'));
  for (let db = 1; db < databases; db += 1) {
    const reserved = await client.set(reservationKey(db), runId, 'EX', RESERVATION_SECONDS, 'NX');
    if (reserved !== 'OK') continue;
    if ((await inDb(client, db, (other) => other.dbsize())) === 0) return db;
    // Someone else's data, written outside any reservation: leave it alone.
    await client.del(reservationKey(db));
  }
  throw new Error(
    `No free Redis database left (${databases} on the server); give it more with \`--databases\``,
  );
}

/** Empties and releases every db `runId` reserved. */
export async function releaseRedisDbs(client: Redis, runId: string): Promise<void> {
  const databases = parseDatabasesReply(await client.config('GET', 'databases'));
  for (let db = 1; db < databases; db += 1) {
    if ((await client.get(reservationKey(db))) !== runId) continue;
    await inDb(client, db, (other) => other.flushdb());
    await client.del(reservationKey(db));
  }
}

/**
 * Runs `command` on db `db` over a connection of its own: `SELECT` on `client`
 * would move every command another caller has in flight on it.
 */
async function inDb<T>(
  client: Redis,
  db: number,
  command: (other: Redis) => Promise<T>,
): Promise<T> {
  const other = client.duplicate({ db, lazyConnect: true });
  try {
    await other.connect();
    return await command(other);
  } finally {
    other.disconnect();
  }
}
