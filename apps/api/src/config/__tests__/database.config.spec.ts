import { beforeEach, describe, expect, it } from 'vitest';
import { databaseConfigFromEnv, poolOptions } from '../database.config';

const POOL_VARS = [
  'DB_POOL_MAX',
  'DB_AUTH_POOL_MAX',
  'DB_CONNECTION_TIMEOUT_MS',
  'DB_STATEMENT_TIMEOUT_MS',
  'DB_LOCK_TIMEOUT_MS',
  'DB_IDLE_IN_TRANSACTION_TIMEOUT_MS',
];

function withEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return databaseConfigFromEnv();
}

describe('databaseConfigFromEnv', () => {
  beforeEach(() => {
    for (const key of POOL_VARS) delete process.env[key];
  });

  it('bounds every pool and timeout by default', () => {
    expect(withEnv({})).toMatchObject({
      poolMax: 10,
      authPoolMax: 5,
      connectionTimeoutMs: 5_000,
      statementTimeoutMs: 15_000,
      lockTimeoutMs: 5_000,
      idleInTransactionTimeoutMs: 30_000,
    });
  });

  it('coerces the values it reads from strings', () => {
    expect(
      withEnv({
        DB_POOL_MAX: '25',
        DB_AUTH_POOL_MAX: '3',
        DB_CONNECTION_TIMEOUT_MS: '1000',
        DB_STATEMENT_TIMEOUT_MS: '60000',
        DB_LOCK_TIMEOUT_MS: '2000',
        DB_IDLE_IN_TRANSACTION_TIMEOUT_MS: '10000',
      }),
    ).toMatchObject({
      poolMax: 25,
      authPoolMax: 3,
      connectionTimeoutMs: 1_000,
      statementTimeoutMs: 60_000,
      lockTimeoutMs: 2_000,
      idleInTransactionTimeoutMs: 10_000,
    });
  });

  it('accepts 0 on a timeout, which switches it off', () => {
    expect(
      withEnv({
        DB_CONNECTION_TIMEOUT_MS: '0',
        DB_STATEMENT_TIMEOUT_MS: '0',
        DB_LOCK_TIMEOUT_MS: '0',
        DB_IDLE_IN_TRANSACTION_TIMEOUT_MS: '0',
      }),
    ).toMatchObject({
      connectionTimeoutMs: 0,
      statementTimeoutMs: 0,
      lockTimeoutMs: 0,
      idleInTransactionTimeoutMs: 0,
    });
  });

  it.each(['0', '-1', 'abc', '2.5'])('refuses DB_POOL_MAX=%s, naming the variable', (value) => {
    expect(() => withEnv({ DB_POOL_MAX: value })).toThrow(/DB_POOL_MAX/);
  });

  it('refuses a negative timeout, naming the variable', () => {
    expect(() => withEnv({ DB_LOCK_TIMEOUT_MS: '-5' })).toThrow(/DB_LOCK_TIMEOUT_MS/);
  });
});

describe('poolOptions', () => {
  beforeEach(() => {
    for (const key of POOL_VARS) delete process.env[key];
  });

  it('sizes and names each pool, and gives both the same timeouts', () => {
    const config = withEnv({ DB_POOL_MAX: '12', DB_AUTH_POOL_MAX: '4' });
    const timeouts = {
      connectionTimeoutMillis: 5_000,
      statement_timeout: 15_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 30_000,
    };

    expect(poolOptions(config, 'api')).toEqual({
      max: 12,
      application_name: 'api',
      ...timeouts,
    });
    expect(poolOptions(config, 'api-auth')).toEqual({
      max: 4,
      application_name: 'api-auth',
      ...timeouts,
    });
  });

  it('passes 0 through, which `pg` and Postgres both read as no limit', () => {
    const config = withEnv({ DB_STATEMENT_TIMEOUT_MS: '0', DB_CONNECTION_TIMEOUT_MS: '0' });

    expect(poolOptions(config, 'api')).toMatchObject({
      statement_timeout: 0,
      connectionTimeoutMillis: 0,
    });
  });
});
