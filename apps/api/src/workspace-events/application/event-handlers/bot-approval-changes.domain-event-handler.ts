import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BotApprovalChangedDomainEvent } from '../../../bots-chat/domain/events/bot-approval-changed.domain-event';
import { WORKSPACE_EVENT_BUS } from '../../workspace-events.di-tokens';
import type { WorkspaceEventBusPort } from '../workspace-event-bus.port';

/**
 * A bot's approval was raised, decided, expired or its call ran: tell its
 * workspace's consoles, whose Inbox lists the pending ones across bots. The
 * bot's own chat hears it on the bot's stream as before.
 */
@Injectable()
export class BotApprovalChangesDomainEventHandler {
  constructor(
    @Inject(WORKSPACE_EVENT_BUS)
    private readonly bus: WorkspaceEventBusPort,
  ) {}

  @OnEvent(BotApprovalChangedDomainEvent.name)
  async handle(
    event: Pick<BotApprovalChangedDomainEvent, 'aggregateId' | 'organizationId' | 'botId'>,
  ): Promise<void> {
    await this.bus.publish(
      { organizationId: event.organizationId },
      { type: 'botApproval.changed', id: event.aggregateId, botId: event.botId },
    );
  }
}
