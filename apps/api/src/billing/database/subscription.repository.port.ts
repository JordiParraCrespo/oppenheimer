import type { Paginated, RepositoryPort } from '@oppenheimer/backend-ddd';
import type { SubscriptionStatus } from '@oppenheimer/shared';
import type { Option } from 'oxide.ts';
import type { SubscriptionEntity } from '../domain/subscription.entity';

export interface FindSubscriptionsParams {
  page: number;
  limit: number;
  status?: SubscriptionStatus;
}

/**
 * Port for persisting and querying the subscription aggregate. Implemented by
 * the TypeORM adapter in `subscription.repository.ts`.
 */
export interface SubscriptionRepositoryPort extends RepositoryPort<SubscriptionEntity> {
  findOneByStripeId(stripeSubscriptionId: string): Promise<Option<SubscriptionEntity>>;
  /** The user's most recently created subscription, if any. */
  findOneByUserId(userId: string): Promise<Option<SubscriptionEntity>>;
  findSubscriptions(params: FindSubscriptionsParams): Promise<Paginated<SubscriptionEntity>>;
  findByStatuses(statuses: readonly SubscriptionStatus[]): Promise<SubscriptionEntity[]>;
  countByStatus(status: SubscriptionStatus): Promise<number>;
  /** Count subscriptions whose `canceledAt` falls on or after `since`. */
  countCanceledSince(since: Date): Promise<number>;
}
