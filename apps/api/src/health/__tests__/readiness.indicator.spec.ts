/**
 * Readiness reads each dependency's answer strictly and within its own
 * deadline: anything but an explicit `up` is unavailable, a hung dependency
 * cannot hold the probe past its timeout, the checks run side by side, and
 * the answer carries one word while the reason goes to the log. The HTTP
 * status it maps to is `health.probe.controller.spec.ts`.
 */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TypeOrmHealthIndicator } from '@nestjs/terminus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RedisHealthIndicator } from '../infrastructure/redis-health.adapter';
import { ReadinessIndicator } from '../probes/readiness.indicator';

const never = () => new Promise<never>(() => {});

function indicator(pingCheck: () => Promise<unknown>, ping: () => Promise<void> = async () => {}) {
  const database = { pingCheck: vi.fn(pingCheck) } as unknown as TypeOrmHealthIndicator;
  const redis = { ping: vi.fn(ping) } as unknown as RedisHealthIndicator;
  const config = new ConfigService({ health: { databaseTimeoutMs: 2_000, redisTimeoutMs: 1_000 } });
  return { readiness: new ReadinessIndicator(database, redis, config), database };
}

const databaseUp = async () => ({ database: { status: 'up' } });

describe('readiness', () => {
  const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  beforeEach(() => error.mockClear());
  afterEach(() => vi.useRealTimers());

  it('is ok only when both dependencies answered up', async () => {
    const { readiness, database } = indicator(databaseUp);

    await expect(readiness.check()).resolves.toEqual({
      status: 'ok',
      checks: { database: { status: 'ok' }, redis: { status: 'ok' } },
    });
    // Terminus is handed the same bound the probe enforces
    expect(database.pingCheck).toHaveBeenCalledWith('database', { timeout: 2_000 });
    expect(error).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a resolved down',
      async () => ({ database: { status: 'down', message: 'timeout of 2000ms' } }),
    ],
    ['a result without the key', async () => ({})],
    ['no result at all', async () => undefined],
  ])('treats %s from the database as unavailable', async (_label, pingCheck) => {
    const { readiness } = indicator(pingCheck);

    await expect(readiness.check()).resolves.toMatchObject({
      status: 'error',
      checks: { database: { status: 'error', message: 'unavailable' }, redis: { status: 'ok' } },
    });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('answers one word for a failure and keeps the driver message for the log', async () => {
    const { readiness } = indicator(databaseUp, async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.7:6379');
    });

    const result = await readiness.check();

    expect(result.checks.redis).toEqual({ status: 'error', message: 'unavailable' });
    expect(JSON.stringify(result)).not.toContain('10.0.0.7');
    expect(JSON.stringify(error.mock.calls)).toContain('ECONNREFUSED');
  });

  it('gives up on a hung dependency at its deadline, checking both side by side', async () => {
    vi.useFakeTimers();
    const { readiness } = indicator(never, never);

    const pending = readiness.check();
    // the longer deadline, not the sum of both
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(pending).resolves.toEqual({
      status: 'error',
      checks: {
        database: { status: 'error', message: 'unavailable' },
        redis: { status: 'error', message: 'unavailable' },
      },
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
