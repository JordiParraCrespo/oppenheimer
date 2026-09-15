import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SUBSCRIPTION_REPOSITORY } from '../../billing.di-tokens';
import type { SubscriptionRepositoryPort } from '../../database/subscription.repository.port';
import type { SubscriptionEntity } from '../../domain/subscription.entity';
import { GetMySubscriptionQuery } from './get-my-subscription.query';

@QueryHandler(GetMySubscriptionQuery)
export class GetMySubscriptionQueryHandler
  implements IQueryHandler<GetMySubscriptionQuery, SubscriptionEntity | null>
{
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepositoryPort,
  ) {}

  async execute(query: GetMySubscriptionQuery): Promise<SubscriptionEntity | null> {
    const found = await this.subscriptions.findOneByUserId(query.userId);
    return found.isSome() ? found.unwrap() : null;
  }
}
