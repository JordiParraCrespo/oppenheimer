import { None, type Option, Some } from 'oxide.ts';
import type { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';
import type { Mapper } from './mapper.interface';
import type { EventfulAggregate, OutboxService } from './outbox/outbox.service';
import type { RepositoryPort } from './repository.port';

/**
 * An aggregate that remembers the state it was loaded in, for conditional
 * writes: `markPersisted()` moves that state to what was just stored.
 */
export interface PersistenceTracked {
  markPersisted(): void;
}

/**
 * The write path a non-tenant TypeORM adapter would otherwise copy: map the
 * aggregate to its record, write it through `OutboxService.writeWithEvents`
 * (so the events it collected are staged in the same transaction), and map
 * the result back, as an `Option` for a lookup. An adapter extends it, keeps
 * its own queries, and overrides what differs (a constraint turned into a
 * catalog error, an extra scoping argument):
 *
 * ```ts
 * @Injectable()
 * export class UserRepository extends TypeOrmRepositoryBase<UserEntity, UserOrmEntity> {
 *   constructor(
 *     @InjectRepository(UserOrmEntity) protected readonly repository: Repository<UserOrmEntity>,
 *     protected readonly mapper: UserMapper,
 *     protected readonly outbox: OutboxService,
 *   ) {
 *     super();
 *   }
 * }
 * ```
 *
 * `save` is a blind upsert: right for a create and for an edit where the last
 * writer may win. A state transition two writers can race (claim a run,
 * resolve a request) is a conditional write, `saveIf`, behind a port method
 * named for the transition.
 *
 * Tenant-scoped repositories do not extend it, and `ScopedRepositoryBase`
 * (`@oppenheimer/backend-authz`) is not built on it: every read there takes an
 * `AccessScope`, and their writes are locked, conditional SQL rather than a
 * plain `save`. What the two kinds share is `OutboxService.transaction`, not a
 * base class.
 */
export abstract class TypeOrmRepositoryBase<
  Aggregate extends EventfulAggregate & { readonly id: string },
  Orm extends ObjectLiteral,
> implements RepositoryPort<Aggregate>
{
  protected abstract readonly repository: Repository<Orm>;
  protected abstract readonly mapper: Pick<Mapper<Aggregate, Orm>, 'toDomain' | 'toPersistence'>;
  protected abstract readonly outbox: OutboxService;
  /** The primary-key column the aggregate's `id` is stored in. */
  protected readonly idColumn: string = 'id';

  async insert(entity: Aggregate | Aggregate[]): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity];
    const records = entities.map((e) => this.mapper.toPersistence(e));
    await this.outbox.writeWithEvents(entities, (manager) => {
      const repository = manager.getRepository<Orm>(this.repository.target);
      // Cast around TypeORM's `QueryDeepPartialEntity` recursion, which cannot
      // represent jsonb columns (free-form records, arrays, unions).
      return repository.insert(records as Parameters<typeof repository.insert>[0]);
    });
  }

  async save(entity: Aggregate): Promise<Aggregate> {
    const record = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository<Orm>(this.repository.target).save(this.mapper.toPersistence(entity)),
    );
    return this.mapper.toDomain(record);
  }

  /**
   * A conditional write: update the aggregate's row only if it still matches
   * `condition` (the state the aggregate was loaded in, say
   * `{ status: run.statusAtLoad }`, or an expected version), and answer
   * whether this write won. One `UPDATE … WHERE id = $1 AND <condition>`
   * that must affect exactly one row: two workers that loaded the same row
   * cannot both apply, and the loser is told instead of silently
   * overwriting the winner.
   *
   * One path whatever the aggregate owes: the `UPDATE` runs on the manager
   * of an `OutboxService.transaction`, and only when it won are the events
   * staged on that manager (so they commit with the write, and the relay is
   * woken after the commit), then cleared, and the aggregate's
   * `markPersisted()` called, so a second conditional write in the same
   * attempt is conditioned on the state this one stored. A lost race stages
   * nothing, so its transaction commits no change, wakes nothing and leaves
   * the events on the aggregate, since they describe a change that did not
   * happen. A caller that gets `false` abandons: it reloads if it still has
   * work, it never retries the same instance.
   *
   * The aggregate must be `PersistenceTracked`: a conditional write is
   * conditioned on the state it was loaded in, so it has to be told when that
   * state moved.
   *
   * Protected: the condition names columns, so a concrete repository wraps
   * it in a port method named for the transition (`claim(run)`).
   */
  protected async saveIf(
    entity: Aggregate & PersistenceTracked,
    condition: FindOptionsWhere<Orm>,
  ): Promise<boolean> {
    const changes: Record<string, unknown> = { ...this.mapper.toPersistence(entity) };
    delete changes[this.idColumn];
    const where = { ...condition, ...this.byId(entity.id) } as FindOptionsWhere<Orm>;
    // Cast around TypeORM's `QueryDeepPartialEntity` recursion (see `insert`).
    type Changes = Parameters<Repository<Orm>['update']>[1];
    const won = await this.outbox.transaction(async (manager) => {
      const result = await manager
        .getRepository<Orm>(this.repository.target)
        .update(where, changes as Changes);
      if (result.affected !== 1) return false;
      await this.outbox.stageEvents(manager, entity.domainEvents);
      return true;
    });
    if (!won) return false;
    entity.clearEvents();
    entity.markPersisted();
    return true;
  }

  async findOneById(id: string): Promise<Option<Aggregate>> {
    return this.toOption(await this.repository.findOneBy(this.byId(id)));
  }

  async delete(entity: Aggregate): Promise<boolean> {
    const result = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository<Orm>(this.repository.target).delete(this.byId(entity.id)),
    );
    return (result.affected ?? 0) > 0;
  }

  protected toOption(record: Orm | null): Option<Aggregate> {
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  private byId(id: string): FindOptionsWhere<Orm> {
    return { [this.idColumn]: id } as FindOptionsWhere<Orm>;
  }
}
