import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Paginated } from '@oppenheimer/backend-ddd';
import { SUBSCRIPTION_REPOSITORY } from '../../billing.di-tokens';
import type { SubscriptionRepositoryPort } from '../../database/subscription.repository.port';
import type { SubscriptionEntity } from '../../domain/subscription.entity';
import { FindSubscriptionsQuery } from './find-subscriptions.query';

@QueryHandler(FindSubscriptionsQuery)
export class FindSubscriptionsQueryHandler
  implements IQueryHandler<FindSubscriptionsQuery, Paginated<SubscriptionEntity>>
{
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepositoryPort,
  ) {}

  execute(query: FindSubscriptionsQuery): Promise<Paginated<SubscriptionEntity>> {
    return this.subscriptions.findSubscriptions({
      page: query.page,
      limit: query.limit,
      status: query.status,
    });
  }
}
