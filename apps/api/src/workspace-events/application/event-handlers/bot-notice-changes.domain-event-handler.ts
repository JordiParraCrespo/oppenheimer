import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BotNoticeChangedDomainEvent } from '../../../bots-chat/domain/events/bot-notice-changed.domain-event';
import { WORKSPACE_EVENT_BUS } from '../../workspace-events.di-tokens';
import type { WorkspaceEventBusPort } from '../workspace-event-bus.port';

/**
 * A bot sent the person a notice (`notify`, `product/next-steps/agent-tools.md`
 * §5): tell its workspace's consoles, whose Inbox lists every bot's latest.
 */
@Injectable()
export class BotNoticeChangesDomainEventHandler {
  constructor(
    @Inject(WORKSPACE_EVENT_BUS)
    private readonly bus: WorkspaceEventBusPort,
  ) {}

  @OnEvent(BotNoticeChangedDomainEvent.name)
  async handle(
    event: Pick<BotNoticeChangedDomainEvent, 'aggregateId' | 'organizationId' | 'botId'>,
  ): Promise<void> {
    await this.bus.publish(
      { organizationId: event.organizationId },
      { type: 'botNotice.changed', id: event.aggregateId, botId: event.botId },
    );
  }
}
