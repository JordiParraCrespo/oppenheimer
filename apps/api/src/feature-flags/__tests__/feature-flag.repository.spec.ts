import type { OutboxService } from '@oppenheimer/backend-ddd';
import type { EntityManager, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { FeatureFlagOrmEntity } from '../database/feature-flag.orm-entity';
import { FeatureFlagRepository } from '../database/feature-flag.repository';
import type { FeatureFlagMapper } from '../feature-flag.mapper';

/** A repository whose transactions record the lock they take, and nothing else. */
function repository() {
  const locks: unknown[] = [];
  const manager = {
    transaction: vi.fn(async (work: (manager: EntityManager) => Promise<unknown>) =>
      work({
        query: async (_sql: string, params: unknown[]) => {
          locks.push(params[0]);
        },
      } as unknown as EntityManager),
    ),
  };
  const flags = new FeatureFlagRepository(
    { manager } as unknown as Repository<FeatureFlagOrmEntity>,
    {} as FeatureFlagMapper,
    {} as OutboxService,
  );
  return { flags, locks };
}

describe('FeatureFlagRepository.serialized', () => {
  it('holds the flag write lock around the work', async () => {
    const { flags, locks } = repository();

    expect(await flags.serialized(async () => 'done')).toBe('done');
    expect(locks).toEqual([0x666c6167]);
  });

  it('runs one write at a time on this replica, in order', async () => {
    const { flags } = repository();
    const order: string[] = [];
    let release: () => void = () => {};
    const first = flags.serialized(
      () =>
        new Promise<void>((resolve) => {
          order.push('first starts');
          release = () => {
            order.push('first ends');
            resolve();
          };
        }),
    );
    const second = flags.serialized(async () => {
      order.push('second starts');
    });

    await vi.waitFor(() => expect(order).toEqual(['first starts']));
    release();
    await Promise.all([first, second]);

    expect(order).toEqual(['first starts', 'first ends', 'second starts']);
  });

  it('lets the next write run after one fails', async () => {
    const { flags } = repository();

    await expect(flags.serialized(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await flags.serialized(async () => 'next')).toBe('next');
  });
});
