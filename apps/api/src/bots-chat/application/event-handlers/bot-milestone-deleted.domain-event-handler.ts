import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MilestoneChangedDomainEvent } from '../../../tasks/domain/events/milestone-changed.domain-event';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';

/**
 * A deleted milestone ends every bot's subscription to it
 * (`27-bot-subscriptions.md` §7.2): nothing will change under it again, and
 * the row names it with no foreign key to cascade it away. Deleting nothing
 * twice is harmless, so a redelivery is too.
 */
@Injectable()
export class BotMilestoneDeletedDomainEventHandler {
  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
  ) {}

  @OnEvent(MilestoneChangedDomainEvent.name, { suppressErrors: false })
  async handle(
    event: Pick<MilestoneChangedDomainEvent, 'aggregateId' | 'organizationId' | 'change'>,
  ): Promise<void> {
    if (event.change !== 'deleted') return;
    await this.subscriptions.endForMilestone(event.organizationId, event.aggregateId);
  }
}
