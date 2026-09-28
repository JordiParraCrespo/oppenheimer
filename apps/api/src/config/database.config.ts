import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

const schema = z.object({
  host: z.string().default('localhost'),
  port: z.coerce.number().default(5432),
  username: z.string().default('oppenheimer'),
  password: z.string().default('oppenheimer'),
  database: z.string().default('oppenheimer'),
  // Off by default: query logging buries every other line under a wall of
  // SELECTs. Even when enabled, bound parameters are never logged — see
  // `TypeOrmQueryLogger`.
  logQueries: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // Pool sizing and timeouts. Each is required, with a safe default: an
  // unbounded wait or statement is how one slow query hangs the whole API, so
  // there is no "unset" state to model. On a timeout `0` means "no limit", in
  // `pg` as in Postgres, and is the only way to switch one off.
  //
  // Connections TypeORM may open for the API's own queries, per replica.
  poolMax: z.coerce.number().int().min(1).default(10),
  // Connections Better Auth may open (sign-in, session lookups, the auth rate
  // limiter), per replica. A second pool, counted against the same budget.
  authPoolMax: z.coerce.number().int().min(1).default(5),
  // How long a query waits for a free connection before failing (ms).
  connectionTimeoutMs: z.coerce.number().int().min(0).default(5_000),
  // Longest a single statement may run (ms). Boot migrations run on their own
  // connection without it; see the TypeORM block in `app.module.ts`.
  statementTimeoutMs: z.coerce.number().int().min(0).default(15_000),
  // Longest a statement waits for a row or table lock (ms), e.g. the
  // `FOR UPDATE` a session-log append takes.
  lockTimeoutMs: z.coerce.number().int().min(0).default(5_000),
  // A transaction left idle this long is ended by Postgres and its locks
  // released (ms).
  idleInTransactionTimeoutMs: z.coerce.number().int().min(0).default(30_000),
});

export type DatabaseConfig = z.infer<typeof schema>;

const ENV_KEYS = {
  host: 'DB_HOST',
  port: 'DB_PORT',
  username: 'DB_USERNAME',
  password: 'DB_PASSWORD',
  database: 'DB_DATABASE',
  logQueries: 'DB_LOG_QUERIES',
  poolMax: 'DB_POOL_MAX',
  authPoolMax: 'DB_AUTH_POOL_MAX',
  connectionTimeoutMs: 'DB_CONNECTION_TIMEOUT_MS',
  statementTimeoutMs: 'DB_STATEMENT_TIMEOUT_MS',
  lockTimeoutMs: 'DB_LOCK_TIMEOUT_MS',
  idleInTransactionTimeoutMs: 'DB_IDLE_IN_TRANSACTION_TIMEOUT_MS',
};

/**
 * The `database` section parsed straight from the environment, for the one
 * consumer that cannot inject `ConfigService`: Better Auth builds its pool at
 * module scope. `databaseConfig` below is the same call, so the two pools
 * cannot disagree about credentials or limits.
 */
export function databaseConfigFromEnv(): DatabaseConfig {
  return parseEnv('database', schema, ENV_KEYS);
}

export const databaseConfig = registerAs('database', () => databaseConfigFromEnv());

/** Which pool the options are for: its size and its name in `pg_stat_activity`. */
export type DatabasePool = 'api' | 'api-auth';

/**
 * `pg.Pool` options shared by both pools; only `max` and `application_name`
 * differ. The timeouts go to Postgres as startup parameters, so they bound
 * every statement on the connection, not only those inside a transaction.
 */
export function poolOptions(config: DatabaseConfig, pool: DatabasePool) {
  return {
    max: pool === 'api' ? config.poolMax : config.authPoolMax,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    statement_timeout: config.statementTimeoutMs,
    lock_timeout: config.lockTimeoutMs,
    idle_in_transaction_session_timeout: config.idleInTransactionTimeoutMs,
    application_name: pool,
  };
}
