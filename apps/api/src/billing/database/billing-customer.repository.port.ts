import type { RepositoryPort } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type { BillingCustomerEntity } from '../domain/billing-customer.entity';

/**
 * Port for persisting and querying the billing-customer aggregate. Implemented
 * by the TypeORM adapter in `billing-customer.repository.ts`.
 */
export interface BillingCustomerRepositoryPort extends RepositoryPort<BillingCustomerEntity> {
  findOneByUserId(userId: string): Promise<Option<BillingCustomerEntity>>;
  findOneByStripeCustomerId(stripeCustomerId: string): Promise<Option<BillingCustomerEntity>>;
}
