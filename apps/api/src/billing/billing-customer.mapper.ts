import { Injectable } from '@nestjs/common';
import { BillingCustomerOrmEntity } from './database/billing-customer.orm-entity';
import { BillingCustomerEntity } from './domain/billing-customer.entity';

/**
 * Maps the billing-customer aggregate between its domain and persistence shapes.
 * There is no response DTO — the mapping is internal (it never leaves the API),
 * so this is a plain mapper rather than the full `Mapper` interface.
 */
@Injectable()
export class BillingCustomerMapper {
  toPersistence(entity: BillingCustomerEntity): BillingCustomerOrmEntity {
    const record = new BillingCustomerOrmEntity();
    record.id = entity.id;
    record.userId = entity.userId;
    record.stripeCustomerId = entity.stripeCustomerId;
    return record;
  }

  toDomain(record: BillingCustomerOrmEntity): BillingCustomerEntity {
    return BillingCustomerEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        userId: record.userId,
        stripeCustomerId: record.stripeCustomerId,
      },
    });
  }
}
