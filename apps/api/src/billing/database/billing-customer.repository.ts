import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Paginated, type PaginatedQueryParams } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, type Repository } from 'typeorm';
import { BillingCustomerMapper } from '../billing-customer.mapper';
import type { BillingCustomerEntity } from '../domain/billing-customer.entity';
import { BillingCustomerOrmEntity } from './billing-customer.orm-entity';
import type { BillingCustomerRepositoryPort } from './billing-customer.repository.port';

/**
 * TypeORM-backed adapter for the billing-customer aggregate. Maps domain ↔ ORM
 * via `BillingCustomerMapper`. The aggregate raises no domain events, so writes
 * do not publish.
 */
@Injectable()
export class BillingCustomerRepository implements BillingCustomerRepositoryPort {
  constructor(
    @InjectRepository(BillingCustomerOrmEntity)
    private readonly repository: Repository<BillingCustomerOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: BillingCustomerMapper,
  ) {}

  async insert(entity: BillingCustomerEntity | BillingCustomerEntity[]): Promise<void> {
    const entities = Array.isArray(entity) ? entity : [entity];
    const records = entities.map((e) => this.mapper.toPersistence(e));
    await this.repository.insert(records);
  }

  async save(entity: BillingCustomerEntity): Promise<BillingCustomerEntity> {
    const record = await this.repository.save(this.mapper.toPersistence(entity));
    return this.mapper.toDomain(record);
  }

  async findOneById(id: string): Promise<Option<BillingCustomerEntity>> {
    const record = await this.repository.findOneBy({ id });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByUserId(userId: string): Promise<Option<BillingCustomerEntity>> {
    const record = await this.repository.findOneBy({ userId });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<Option<BillingCustomerEntity>> {
    const record = await this.repository.findOneBy({ stripeCustomerId });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findAll(): Promise<BillingCustomerEntity[]> {
    const records = await this.repository.find();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findAllPaginated(params: PaginatedQueryParams): Promise<Paginated<BillingCustomerEntity>> {
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

  async delete(entity: BillingCustomerEntity): Promise<boolean> {
    const result = await this.repository.delete({ id: entity.id });
    return result.affected ? result.affected > 0 : false;
  }

  transaction<T>(handler: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(() => handler());
  }
}
