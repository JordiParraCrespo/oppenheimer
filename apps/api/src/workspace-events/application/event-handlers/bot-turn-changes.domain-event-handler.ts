import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BotTurnChangedDomainEvent } from '../../../bots-chat/domain/events/bot-turn-changed.domain-event';
import { WORKSPACE_EVENT_BUS } from '../../workspace-events.di-tokens';
import type { WorkspaceEventBusPort } from '../workspace-event-bus.port';

/**
 * A bot's turn was queued or ended: tell its workspace's consoles, whose
 * sidebar shows which bots are working.
 */
@Injectable()
export class BotTurnChangesDomainEventHandler {
  constructor(
    @Inject(WORKSPACE_EVENT_BUS)
    private readonly bus: WorkspaceEventBusPort,
  ) {}

  @OnEvent(BotTurnChangedDomainEvent.name)
  async handle(
    event: Pick<BotTurnChangedDomainEvent, 'aggregateId' | 'organizationId' | 'botId'>,
  ): Promise<void> {
    await this.bus.publish(
      { organizationId: event.organizationId },
      { type: 'botTurn.changed', id: event.aggregateId, botId: event.botId },
    );
  }
}
