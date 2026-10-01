import type { OutboxService } from '@oppenheimer/backend-ddd';
import type { EntityManager, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { FeatureFlagOrmEntity } from '../database/feature-flag.orm-entity';
import { FeatureFlagRepository } from '../database/feature-flag.repository';
import { FeatureFlagEntity } from '../domain/feature-flag.entity';
import type { FeatureFlagMapper } from '../feature-flag.mapper';

/** A repository whose transaction is one fake manager that records what runs on it. */
function repository() {
  const locks: unknown[] = [];
  const saved: unknown[] = [];
  const manager = {
    query: vi.fn(async (_sql: string, params: unknown[]) => {
      locks.push(params[0]);
    }),
    getRepository: vi.fn(() => ({
      save: vi.fn(async (record: unknown) => {
        saved.push(record);
        return record;
      }),
    })),
  } as unknown as EntityManager;
  const outbox = {
    transaction: vi.fn((work: (manager: EntityManager) => Promise<unknown>) => work(manager)),
    stageEvents: vi.fn(async () => {}),
  };
  const mapper = { toPersistence: vi.fn((e) => ({ key: e.key })), toDomain: vi.fn((r) => r) };
  const flags = new FeatureFlagRepository(
    {} as Repository<FeatureFlagOrmEntity>,
    mapper as unknown as FeatureFlagMapper,
    outbox as unknown as OutboxService,
  );
  return { flags, manager, locks, saved, outbox };
}

describe('FeatureFlagRepository.serialized', () => {
  it('hands the work the transaction that holds the flag write lock', async () => {
    const { flags, manager, locks } = repository();

    const received = await flags.serialized(async (m) => m);

    expect(received).toBe(manager);
    expect(locks).toEqual([0x666c6167]);
  });

  it('writes and stages events on the manager it is given, not on a second transaction', async () => {
    const { flags, manager, saved, outbox } = repository();
    const flag = FeatureFlagEntity.createFor('api_token_creation', true);
    flag.setEnabled(false, { actorId: 'admin-1' });

    await flags.serialized((m) => flags.save(flag, m));

    expect(saved).toHaveLength(1);
    expect(outbox.stageEvents).toHaveBeenCalledWith(manager, flag.domainEvents);
    expect(outbox.transaction).toHaveBeenCalledTimes(1);
  });

  it('lets the next write run after one fails', async () => {
    const { flags } = repository();

    await expect(flags.serialized(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await flags.serialized(async () => 'next')).toBe('next');
  });
});
