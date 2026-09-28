import {
  AggregateRoot,
  DomainEvent,
  OutboxService,
  TypeOrmRepositoryBase,
} from '@oppenheimer/backend-ddd';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

class ThingRenamedDomainEvent extends DomainEvent {}

class Thing extends AggregateRoot<{ name: string }> {
  get name(): string {
    return this.props.name;
  }

  rename(name: string): void {
    this.props.name = name;
    this.addEvent(new ThingRenamedDomainEvent({ aggregateId: this.id }));
  }

  validate(): void {}
}

interface ThingRecord {
  id: string;
  name: string;
}

class ThingTarget {}

class ThingRepository extends TypeOrmRepositoryBase<Thing, ThingRecord> {
  protected readonly mapper = {
    toPersistence: (thing: Thing): ThingRecord => ({ id: thing.id, name: thing.name }),
    toDomain: (record: ThingRecord) => new Thing({ id: record.id, props: { name: record.name } }),
  };

  constructor(
    protected readonly repository: Repository<ThingRecord>,
    protected readonly outbox: OutboxService,
  ) {
    super();
  }
}

/**
 * The base over a real `OutboxService` and a DataSource stub: the ORM
 * repository the write sees is whichever the manager hands out, and the outbox
 * rows land in `outboxInsert`, so a write can be shown to map, stage and
 * commit through one manager.
 */
function harness(overrides: Partial<Record<'findOneBy' | 'delete', unknown>> = {}) {
  const orm = {
    insert: vi.fn().mockResolvedValue({}),
    save: vi.fn(async (record: ThingRecord) => record),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
    findOneBy: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
  const outboxInsert = vi.fn().mockResolvedValue(undefined);
  const manager = {
    getRepository: vi.fn((target: unknown) =>
      target === ThingTarget ? orm : { insert: outboxInsert },
    ),
  } as unknown as EntityManager;
  const transaction = vi.fn(async (work: (m: EntityManager) => Promise<unknown>) => work(manager));
  const outbox = new OutboxService({ transaction, manager } as unknown as DataSource);
  const drainer = vi.fn(async () => undefined);
  outbox.registerDrainer(drainer);
  const repository = new ThingRepository(
    { ...orm, target: ThingTarget } as unknown as Repository<ThingRecord>,
    outbox,
  );
  return { repository, orm, outboxInsert, transaction, drainer };
}

const thing = (id = 'thing-1') => new Thing({ id, props: { name: 'before' } });

describe('TypeOrmRepositoryBase', () => {
  it('insert maps every aggregate and stages their events in the same transaction', async () => {
    const { repository, orm, outboxInsert, transaction, drainer } = harness();
    const one = thing('thing-1');
    const two = thing('thing-2');
    one.rename('after');

    await repository.insert([one, two]);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(orm.insert).toHaveBeenCalledWith([
      { id: 'thing-1', name: 'after' },
      { id: 'thing-2', name: 'before' },
    ]);
    expect(outboxInsert).toHaveBeenCalledTimes(1);
    expect(one.domainEvents).toHaveLength(0);
    expect(drainer).toHaveBeenCalledTimes(1);
  });

  it('save writes the mapped record without a transaction when nothing is owed', async () => {
    const { repository, orm, transaction, drainer } = harness();

    const saved = await repository.save(thing());

    expect(transaction).not.toHaveBeenCalled();
    expect(orm.save).toHaveBeenCalledWith({ id: 'thing-1', name: 'before' });
    expect(saved).toBeInstanceOf(Thing);
    expect(saved.name).toBe('before');
    expect(drainer).not.toHaveBeenCalled();
  });

  it('findOneById answers None for a missing row, and Some of the aggregate otherwise', async () => {
    const missing = harness();
    expect((await missing.repository.findOneById('nope')).isNone()).toBe(true);
    expect(missing.orm.findOneBy).toHaveBeenCalledWith({ id: 'nope' });

    const found = harness({
      findOneBy: vi.fn().mockResolvedValue({ id: 'thing-1', name: 'stored' }),
    });
    expect((await found.repository.findOneById('thing-1')).unwrap().name).toBe('stored');
  });

  it('delete answers false when no row was affected', async () => {
    const { repository, orm } = harness({ delete: vi.fn().mockResolvedValue({ affected: 0 }) });

    await expect(repository.delete(thing())).resolves.toBe(false);
    expect(orm.delete).toHaveBeenCalledWith({ id: 'thing-1' });
  });

  it('delete answers true when the row went, and false when the driver reports no count', async () => {
    await expect(harness().repository.delete(thing())).resolves.toBe(true);
    const unknown = harness({ delete: vi.fn().mockResolvedValue({}) });
    await expect(unknown.repository.delete(thing())).resolves.toBe(false);
  });
});
