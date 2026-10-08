import type { DataSource, EntityManager, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { AggregateRoot } from '../aggregate-root.base';
import { DomainEvent } from '../domain-event.base';
import { OutboxService } from '../outbox/outbox.service';
import { TypeOrmRepositoryBase } from '../typeorm-repository.base';

class ThingRenamedDomainEvent extends DomainEvent {}

class Thing extends AggregateRoot<{ name: string; status: string }> {
  private _statusAtLoad = this.props.status;

  get name(): string {
    return this.props.name;
  }

  get statusAtLoad(): string {
    return this._statusAtLoad;
  }

  close(): void {
    this.props.status = 'closed';
    this.addEvent(new ThingRenamedDomainEvent({ aggregateId: this.id }));
  }

  markPersisted(): void {
    this._statusAtLoad = this.props.status;
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
  status: string;
}

class ThingTarget {}

class ThingRepository extends TypeOrmRepositoryBase<Thing, ThingRecord> {
  protected readonly mapper = {
    toPersistence: (thing: Thing): ThingRecord => ({
      id: thing.id,
      name: thing.name,
      status: thing.getProps().status,
    }),
    toDomain: (record: ThingRecord) =>
      new Thing({ id: record.id, props: { name: record.name, status: record.status } }),
  };

  /** The port method a conditional write sits behind. */
  close(thing: Thing): Promise<boolean> {
    return this.saveIf(thing, { status: thing.statusAtLoad });
  }

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
function harness(overrides: Partial<Record<'findOneBy' | 'delete' | 'update', unknown>> = {}) {
  const orm = {
    insert: vi.fn().mockResolvedValue({}),
    save: vi.fn(async (record: ThingRecord) => record),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
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

const thing = (id = 'thing-1') => new Thing({ id, props: { name: 'before', status: 'open' } });

describe('TypeOrmRepositoryBase', () => {
  it('insert maps every aggregate and stages their events in the same transaction', async () => {
    const { repository, orm, outboxInsert, transaction, drainer } = harness();
    const one = thing('thing-1');
    const two = thing('thing-2');
    one.rename('after');

    await repository.insert([one, two]);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(orm.insert).toHaveBeenCalledWith([
      { id: 'thing-1', name: 'after', status: 'open' },
      { id: 'thing-2', name: 'before', status: 'open' },
    ]);
    expect(outboxInsert).toHaveBeenCalledTimes(1);
    expect(one.domainEvents).toHaveLength(0);
    expect(drainer).toHaveBeenCalledTimes(1);
  });

  it('save writes the mapped record without a transaction when nothing is owed', async () => {
    const { repository, orm, transaction, drainer } = harness();

    const saved = await repository.save(thing());

    expect(transaction).not.toHaveBeenCalled();
    expect(orm.save).toHaveBeenCalledWith({ id: 'thing-1', name: 'before', status: 'open' });
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

  it.each([
    ['true when the row went', { affected: 1 }, true],
    ['false when no row was affected', { affected: 0 }, false],
    ['false when the driver reports no count', {}, false],
  ])('delete answers %s', async (_case, result, expected) => {
    const { repository, orm } = harness({ delete: vi.fn().mockResolvedValue(result) });

    await expect(repository.delete(thing())).resolves.toBe(expected);
    expect(orm.delete).toHaveBeenCalledWith({ id: 'thing-1' });
  });

  describe('saveIf, the conditional write', () => {
    it('updates only the row still in the loaded state, stages the events with it, and marks it persisted', async () => {
      const { repository, orm, outboxInsert, transaction, drainer } = harness();
      const t = thing();
      t.close();

      await expect(repository.close(t)).resolves.toBe(true);

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(orm.update).toHaveBeenCalledWith(
        { status: 'open', id: 'thing-1' },
        { name: 'before', status: 'closed' },
      );
      expect(outboxInsert).toHaveBeenCalledTimes(1);
      expect(t.domainEvents).toHaveLength(0);
      // A second write in the same attempt is conditioned on what this one stored.
      expect(t.statusAtLoad).toBe('closed');
      expect(drainer).toHaveBeenCalledTimes(1);
    });

    it('answers false on a lost race and stages nothing for the change that did not happen', async () => {
      const { repository, outboxInsert, drainer } = harness({
        update: vi.fn().mockResolvedValue({ affected: 0 }),
      });
      const t = thing();
      t.close();

      await expect(repository.close(t)).resolves.toBe(false);

      expect(outboxInsert).not.toHaveBeenCalled();
      expect(drainer).not.toHaveBeenCalled();
      expect(t.domainEvents).toHaveLength(1);
      expect(t.statusAtLoad).toBe('open');
    });

    it('needs no transaction when nothing is owed, and still reports the race', async () => {
      const won = harness();
      await expect(won.repository.close(thing())).resolves.toBe(true);
      expect(won.transaction).not.toHaveBeenCalled();

      const lost = harness({ update: vi.fn().mockResolvedValue({ affected: 0 }) });
      await expect(lost.repository.close(thing())).resolves.toBe(false);
    });
  });
});
