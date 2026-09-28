import { None, type Option, Some } from 'oxide.ts';
import type { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';
import type { Mapper } from './mapper.interface';
import type { EventfulAggregate, OutboxService } from './outbox/outbox.service';
import type { RepositoryPort } from './repository.port';

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

  async findOneById(id: string): Promise<Option<Aggregate>> {
    return this.toOption(await this.repository.findOneBy(this.byId(id)));
  }

  async delete(entity: Aggregate): Promise<boolean> {
    const result = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository<Orm>(this.repository.target).delete(this.byId(entity.id)),
    );
    return (result.affected ?? 0) > 0;
  }

  /** A looked-up record as the domain's `Option`. */
  protected toOption(record: Orm | null): Option<Aggregate> {
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  private byId(id: string): FindOptionsWhere<Orm> {
    return { [this.idColumn]: id } as FindOptionsWhere<Orm>;
  }
}
