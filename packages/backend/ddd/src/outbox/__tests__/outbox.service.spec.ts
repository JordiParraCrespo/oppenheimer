import type { DataSource, EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { DomainEvent, type DomainEventProps } from '../../domain-event.base';
import { OutboxService } from '../outbox.service';

class ThingDeletedDomainEvent extends DomainEvent {
  readonly name: string;

  constructor(props: DomainEventProps<ThingDeletedDomainEvent>) {
    super(props);
    this.name = props.name;
  }
}

describe('OutboxService', () => {
  const managerWith = (insert: ReturnType<typeof vi.fn>) =>
    ({ getRepository: () => ({ insert }) }) as unknown as EntityManager;

  describe('stageEvents', () => {
    it('writes one self-explaining row per event through the given manager', async () => {
      const insert = vi.fn().mockResolvedValue(undefined);
      const service = new OutboxService({} as DataSource);
      const event = new ThingDeletedDomainEvent({
        aggregateId: 'agg-1',
        name: 'thing',
        reason: 'Thing was deleted; cleanup is owed',
      });

      await service.stageEvents(managerWith(insert), [event]);

      expect(insert).toHaveBeenCalledTimes(1);
      const [rows] = insert.mock.calls[0];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        channel: 'event',
        eventName: 'ThingDeletedDomainEvent',
        aggregateId: 'agg-1',
        reason: 'Thing was deleted; cleanup is owed',
        status: 'pending',
        correlationId: event.metadata.correlationId,
      });
      // The payload is the serialized event: what listeners will receive.
      expect(rows[0].payload).toMatchObject({
        aggregateId: 'agg-1',
        name: 'thing',
      });
    });

    it('falls back to a generated reason when the event carries none', async () => {
      const insert = vi.fn().mockResolvedValue(undefined);
      const service = new OutboxService({} as DataSource);
      const event = new ThingDeletedDomainEvent({
        aggregateId: 'agg-2',
        name: 'thing',
      });

      await service.stageEvents(managerWith(insert), [event]);

      const [rows] = insert.mock.calls[0];
      expect(rows[0].reason).toContain('ThingDeletedDomainEvent');
      expect(rows[0].reason).toContain('agg-2');
    });
  });

  describe('stageJob', () => {
    it('writes a queue row targeting the named BullMQ queue', async () => {
      const insert = vi.fn().mockResolvedValue(undefined);
      const service = new OutboxService({} as DataSource);

      await service.stageJob(managerWith(insert), {
        queue: 'email',
        jobName: 'send-verification',
        payload: { to: 'a@b.c' },
        reason: 'User signed up; a verification email is owed',
      });

      expect(insert.mock.calls[0][0]).toMatchObject({
        channel: 'queue',
        topic: 'email',
        eventName: 'send-verification',
        payload: { to: 'a@b.c' },
        reason: 'User signed up; a verification email is owed',
      });
    });
  });

  describe('markFailed', () => {
    const record = (attempts: number) =>
      ({ id: 'row-1', attempts }) as Parameters<OutboxService['markFailed']>[0];

    // params: [id, status, error, delayMs, attempts, lockedBy]; the last two
    // fence the update on the claim it came from.
    it.each([
      ['returns the row to pending, backing off base * 2^(attempt-1)', 2, {}, 'pending', 2000],
      ['parks the row as failed once attempts are exhausted', 3, {}, 'failed', 4000],
      [
        'caps the backoff at maxRetryDelayMs',
        50,
        { maxAttempts: 100, maxRetryDelayMs: 4000 },
        'pending',
        4000,
      ],
    ] as const)('%s', async (_case, attempts, options, status, delayMs) => {
      const query = vi.fn().mockResolvedValue([]);
      const service = new OutboxService({ query } as unknown as DataSource, {
        maxAttempts: 3,
        baseRetryDelayMs: 1000,
        ...options,
      });

      await service.markFailed(record(attempts), 'boom');

      const [, params] = query.mock.calls[0];
      expect(params).toEqual(['row-1', status, 'boom', delayMs, attempts, null]);
    });
  });

  describe('wake', () => {
    it('starts the registered drainer without waiting for it', () => {
      const service = new OutboxService({} as DataSource);
      const drainer = vi.fn(() => new Promise(() => {}));
      service.registerDrainer(drainer);

      expect(service.wake()).toBeUndefined();
      expect(drainer).toHaveBeenCalledTimes(1);
    });

    it('never throws, and logs a failed drain', async () => {
      const warn = vi.fn();
      const service = new OutboxService({} as DataSource, { logger: { warn } });
      service.registerDrainer(vi.fn().mockRejectedValue(new Error('db gone')));

      expect(() => service.wake()).not.toThrow();
      await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining('db gone')));

      service.registerDrainer(() => {
        throw new Error('sync boom');
      });
      expect(() => service.wake()).not.toThrow();
      expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('sync boom'));
    });

    it('is a no-op with no drainer registered', () => {
      const service = new OutboxService({} as DataSource);
      expect(service.wake()).toBeUndefined();
    });
  });

  describe('transaction', () => {
    /**
     * A DataSource whose `transaction` hands the callback a fresh manager and
     * logs `commit` once the callback resolves, so a wake can be shown to come
     * after it. A rejected callback rejects without a commit, as TypeORM does.
     */
    const harness = () => {
      const log: string[] = [];
      const insert = vi.fn().mockResolvedValue(undefined);
      const managers: EntityManager[] = [];
      const transaction = vi.fn(async (cb: (m: EntityManager) => Promise<unknown>) => {
        const manager = managerWith(insert);
        managers.push(manager);
        const value = await cb(manager);
        log.push('commit');
        return value;
      });
      const service = new OutboxService({ transaction } as unknown as DataSource);
      const drainer = vi.fn(async () => {
        log.push('drain');
      });
      service.registerDrainer(drainer);
      return { service, drainer, transaction, insert, log, managers };
    };
    const event = () => new ThingDeletedDomainEvent({ aggregateId: 'agg-1', name: 'thing' });
    const job = {
      queue: 'email',
      jobName: 'send',
      payload: {},
      reason: 'a test owes a job',
    };

    it('wakes once, after the commit, when events were staged', async () => {
      const { service, drainer, transaction, log } = harness();

      const result = await service.transaction(async (manager) => {
        await service.stageEvents(manager, [event()]);
        await service.stageEvents(manager, [event()]);
        return 'done';
      });

      expect(result).toBe('done');
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(drainer).toHaveBeenCalledTimes(1);
      expect(log).toEqual(['commit', 'drain']);
    });

    it('does not wake when nothing was staged', async () => {
      const { service, drainer } = harness();

      await expect(service.transaction(async () => 'nothing owed')).resolves.toBe('nothing owed');

      expect(drainer).not.toHaveBeenCalled();
    });

    it('does not wake when the work throws after staging, and the error propagates', async () => {
      const { service, drainer, insert, log } = harness();

      await expect(
        service.transaction(async (manager) => {
          await service.stageJob(manager, job);
          throw new Error('lost the race');
        }),
      ).rejects.toThrow('lost the race');

      // Staged, then rolled back: the row never landed, so there is nothing to deliver.
      expect(insert).toHaveBeenCalledTimes(1);
      expect(log).toEqual([]);
      expect(drainer).not.toHaveBeenCalled();
    });

    it('counts a staged job as staged', async () => {
      const { service, drainer } = harness();

      await service.transaction((manager) => service.stageJob(manager, job));

      expect(drainer).toHaveBeenCalledTimes(1);
    });

    it('does not count an empty event list as staged', async () => {
      const { service, drainer, insert } = harness();

      await service.transaction((manager) => service.stageEvents(manager, []));

      expect(insert).not.toHaveBeenCalled();
      expect(drainer).not.toHaveBeenCalled();
    });

    it('forgets each transaction: a second one that stages nothing does not wake', async () => {
      const { service, drainer } = harness();

      await service.transaction((manager) => service.stageJob(manager, job));
      await service.transaction(async () => undefined);

      expect(drainer).toHaveBeenCalledTimes(1);
    });

    it('leaves a manager it did not open alone: staging on it neither throws nor wakes', async () => {
      const { service, drainer } = harness();
      const outside = managerWith(vi.fn().mockResolvedValue(undefined));

      await service.transaction(async () => {
        await service.stageEvents(outside, [event()]);
        await service.stageJob(outside, job);
      });
      await service.stageEvents(outside, [event()]);

      expect(drainer).not.toHaveBeenCalled();
    });
  });

  describe('writeWithEvents', () => {
    it('runs the write and the event staging in one transaction, then clears and wakes', async () => {
      const insert = vi.fn().mockResolvedValue(undefined);
      const txManager = managerWith(insert);
      const transaction = vi.fn(async (cb: (m: EntityManager) => Promise<unknown>) =>
        cb(txManager),
      );
      const service = new OutboxService({
        transaction,
      } as unknown as DataSource);
      // A drain that never settles: the write must not wait for it.
      const drainer = vi.fn(() => new Promise(() => {}));
      service.registerDrainer(drainer);

      const event = new ThingDeletedDomainEvent({
        aggregateId: 'agg-1',
        name: 'thing',
      });
      const aggregate = {
        domainEvents: [event],
        clearEvents: vi.fn(),
      };
      const write = vi.fn().mockResolvedValue('written');

      const result = await service.writeWithEvents([aggregate], write);

      expect(result).toBe('written');
      expect(transaction).toHaveBeenCalledTimes(1);
      // The write and the staging both went through the transaction's manager.
      expect(write).toHaveBeenCalledWith(txManager);
      expect(insert).toHaveBeenCalledTimes(1);
      expect(aggregate.clearEvents).toHaveBeenCalledTimes(1);
      expect(drainer).toHaveBeenCalledTimes(1);
    });

    it('skips the explicit transaction, and the wake, when no events were collected', async () => {
      const manager = managerWith(vi.fn());
      const transaction = vi.fn();
      const service = new OutboxService({
        transaction,
        manager,
      } as unknown as DataSource);
      const drainer = vi.fn();
      service.registerDrainer(drainer);
      const write = vi.fn().mockResolvedValue('written');

      const result = await service.writeWithEvents(
        [{ domainEvents: [], clearEvents: vi.fn() }],
        write,
      );

      expect(result).toBe('written');
      expect(transaction).not.toHaveBeenCalled();
      expect(write).toHaveBeenCalledWith(manager);
      expect(drainer).not.toHaveBeenCalled();
    });

    it('does not clear events or wake when the transaction fails', async () => {
      const transaction = vi.fn().mockRejectedValue(new Error('constraint violation'));
      const service = new OutboxService({
        transaction,
      } as unknown as DataSource);
      const drainer = vi.fn();
      service.registerDrainer(drainer);
      const aggregate = {
        domainEvents: [new ThingDeletedDomainEvent({ aggregateId: 'agg-1', name: 'thing' })],
        clearEvents: vi.fn(),
      };

      await expect(service.writeWithEvents([aggregate], vi.fn())).rejects.toThrow(
        'constraint violation',
      );
      expect(aggregate.clearEvents).not.toHaveBeenCalled();
      expect(drainer).not.toHaveBeenCalled();
    });
  });
});
