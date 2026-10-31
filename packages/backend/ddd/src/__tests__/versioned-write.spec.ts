import type { DataSource, EntityManager, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { DomainEvent } from '../domain-event.base';
import { VersionConflictException } from '../exceptions';
import { OutboxService } from '../outbox/outbox.service';
import { TypeOrmRepositoryBase } from '../typeorm-repository.base';
import { VersionedAggregateRoot } from '../versioned-aggregate-root.base';
import { retryOnVersionConflict } from '../versioned-write';

/**
 * The versioned write's contract as its callers see it: the statement it
 * sends, a lost write as a `VersionConflictException` that stages nothing,
 * and the retry that reloads once. That the statement is right against real
 * Postgres (two loads, interleaved saves) is proven by the hosts integration
 * suite, the first module on it.
 */

class NoteEditedDomainEvent extends DomainEvent {}

class Note extends VersionedAggregateRoot<{ text: string }> {
  edit(text: string): void {
    this.props.text = text;
    this.addEvent(new NoteEditedDomainEvent({ aggregateId: this.id }));
  }

  validate(): void {}
}

class NoteTarget {}

interface NoteRecord {
  id: string;
  text: string;
  version: number;
  updatedAt?: Date;
}

/** A non-tenant repository on the base's default write. */
class NoteRepository extends TypeOrmRepositoryBase<Note, NoteRecord> {
  protected readonly repository = { target: NoteTarget } as unknown as Repository<NoteRecord>;
  protected readonly mapper = {
    toPersistence: (note: Note): NoteRecord => ({
      id: note.id,
      text: note.getProps().text,
      version: note.version,
      updatedAt: undefined,
    }),
    toDomain: (record: NoteRecord) =>
      new Note({ id: record.id, version: record.version, props: { text: record.text } }),
  };

  constructor(protected readonly outbox: OutboxService) {
    super();
  }

  update(note: Note): Promise<void> {
    return this.saveVersioned(note);
  }
}

/** A manager whose one `UPDATE` affects `affected` rows, and an outbox over it. */
function harness(affected: number) {
  const builder = {
    update: vi.fn(() => builder),
    set: vi.fn(() => builder),
    where: vi.fn(() => builder),
    execute: vi.fn(async () => ({ affected })),
  };
  const outboxInsert = vi.fn().mockResolvedValue(undefined);
  const manager = {
    createQueryBuilder: vi.fn(() => builder),
    getRepository: vi.fn(() => ({ insert: outboxInsert })),
  } as unknown as EntityManager;
  const transaction = vi.fn(async (work: (m: EntityManager) => Promise<unknown>) => work(manager));
  const outbox = new OutboxService({ transaction, manager } as unknown as DataSource);
  return { builder, outbox, outboxInsert };
}

function save(outbox: OutboxService, note: Note): Promise<void> {
  return new NoteRepository(outbox).update(note);
}

describe('writeVersioned, through TypeOrmRepositoryBase.saveVersioned', () => {
  it('updates the row only at the loaded version, bumping it, and leaves unset columns alone', async () => {
    const { builder, outbox, outboxInsert } = harness(1);
    const note = new Note({ id: 'note-1', version: 3, props: { text: 'before' } });
    note.edit('after');

    await save(outbox, note);

    const [set] = builder.set.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(Object.keys(set).sort()).toEqual(['text', 'version']);
    expect(set.text).toBe('after');
    expect((set.version as () => string)()).toBe('"version" + 1');
    expect(builder.where).toHaveBeenCalledWith({ id: 'note-1', version: 3 });
    expect(outboxInsert).toHaveBeenCalledTimes(1);
    expect(note.version).toBe(4);
    expect(note.domainEvents).toHaveLength(0);
  });

  it('refuses a write on a stale copy with GENERIC.VERSION_CONFLICT and stages nothing', async () => {
    const { outbox, outboxInsert } = harness(0);
    const note = new Note({ id: 'note-1', version: 3, props: { text: 'before' } });
    note.edit('after');

    await expect(save(outbox, note)).rejects.toMatchObject({
      code: 'GENERIC.VERSION_CONFLICT',
      httpStatus: 409,
    });

    expect(outboxInsert).not.toHaveBeenCalled();
    expect(note.version).toBe(3);
  });

  it('starts a new aggregate at version 1, the column default', () => {
    expect(new Note({ id: 'note-1', props: { text: '' } }).version).toBe(1);
  });
});

describe('retryOnVersionConflict', () => {
  it('runs the attempt once more after a conflict, and answers what that try returned', async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new VersionConflictException('stale'))
      .mockResolvedValueOnce('done');

    await expect(retryOnVersionConflict(attempt)).resolves.toBe('done');
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('rethrows the conflict once the attempts are spent', async () => {
    const attempt = vi.fn().mockRejectedValue(new VersionConflictException('stale'));

    await expect(retryOnVersionConflict(attempt)).rejects.toMatchObject({
      code: 'GENERIC.VERSION_CONFLICT',
    });
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('does not retry any other failure', async () => {
    const attempt = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(retryOnVersionConflict(attempt)).rejects.toThrow('boom');
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
