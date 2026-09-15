import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService, Paginated, type PaginatedQueryParams } from '@oppenheimer/backend-ddd';
import type { SubscriptionStatus } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, In, MoreThanOrEqual, type Repository } from 'typeorm';
import type { SubscriptionEntity } from '../domain/subscription.entity';
import { SubscriptionMapper } from '../subscription.mapper';
import { SubscriptionOrmEntity } from './subscription.orm-entity';
import type {
  FindSubscriptionsParams,
  SubscriptionRepositoryPort,
} from './subscription.repository.port';

/**
 * TypeORM-backed adapter for the subscription aggregate. Translates between the
 * domain `SubscriptionEntity` and its ORM persistence model via
 * `SubscriptionMapper` and stages domain events on the transactional outbox,
 * atomically with the write that raised them.
 */
@Injectable()
export class SubscriptionRepository implements SubscriptionRepositoryPort {
  constructor(
    @InjectRepository(SubscriptionOrmEntity)
    private readonly repository: Repository<SubscriptionOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: SubscriptionMapper,
    private readonly outbox: OutboxService,
  ) {}

  async insert(entity: SubscriptionEntity | SubscriptionEntity[]): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity];
    const records = entities.map((e) => this.mapper.toPersistence(e));
    await this.outbox.writeWithEvents(entities, (manager) =>
      manager.getRepository(SubscriptionOrmEntity).insert(records),
    );
  }

  async save(entity: SubscriptionEntity): Promise<SubscriptionEntity> {
    const record = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(SubscriptionOrmEntity).save(this.mapper.toPersistence(entity)),
    );
    return this.mapper.toDomain(record);
  }

  async findOneById(id: string): Promise<Option<SubscriptionEntity>> {
    const record = await this.repository.findOneBy({ id });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByStripeId(stripeSubscriptionId: string): Promise<Option<SubscriptionEntity>> {
    const record = await this.repository.findOneBy({ stripeSubscriptionId });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByUserId(userId: string): Promise<Option<SubscriptionEntity>> {
    const record = await this.repository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findAll(): Promise<SubscriptionEntity[]> {
    const records = await this.repository.find();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findAllPaginated(params: PaginatedQueryParams): Promise<Paginated<SubscriptionEntity>> {
    const [records, count] = await this.repository.findAndCount({
      skip: params.offset,
      take: params.limit,
      order: { createdAt: params.orderBy.param === 'asc' ? 'ASC' : 'DESC' },
    });
    return new Paginated({
      count,
      limit: params.limit,
      page: params.page,
      data: records.map((record) => this.mapper.toDomain(record)),
    });
  }

  async findSubscriptions(params: FindSubscriptionsParams): Promise<Paginated<SubscriptionEntity>> {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const [records, count] = await this.repository.findAndCount({
      where: status ? { status } : {},
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return new Paginated({
      count,
      limit,
      page,
      data: records.map((record) => this.mapper.toDomain(record)),
    });
  }

  async findByStatuses(statuses: readonly SubscriptionStatus[]): Promise<SubscriptionEntity[]> {
    if (statuses.length === 0) return [];
    const records = await this.repository.findBy({
      status: In(statuses as SubscriptionStatus[]),
    });
    return records.map((record) => this.mapper.toDomain(record));
  }

  countByStatus(status: SubscriptionStatus): Promise<number> {
    return this.repository.countBy({ status });
  }

  countCanceledSince(since: Date): Promise<number> {
    return this.repository.countBy({ canceledAt: MoreThanOrEqual(since) });
  }

  async delete(entity: SubscriptionEntity): Promise<boolean> {
    const result = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(SubscriptionOrmEntity).delete({ id: entity.id }),
    );
    return result.affected ? result.affected > 0 : false;
  }

  transaction<T>(handler: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(() => handler());
  }
}
