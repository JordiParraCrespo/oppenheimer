import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InboxMarkChangedDomainEvent } from '../../../inbox/domain/events/inbox-mark-changed.domain-event';
import { WORKSPACE_EVENT_BUS } from '../../workspace-events.di-tokens';
import type { WorkspaceEventBusPort } from '../workspace-event-bus.port';

/**
 * A person set or removed one of their Inbox marks: tell that person's
 * consoles, and nobody else's, so two tabs stay in step. A mark is a
 * person's even in a shared workspace.
 */
@Injectable()
export class InboxMarkChangesDomainEventHandler {
  constructor(
    @Inject(WORKSPACE_EVENT_BUS)
    private readonly bus: WorkspaceEventBusPort,
  ) {}

  @OnEvent(InboxMarkChangedDomainEvent.name)
  async handle(event: Pick<InboxMarkChangedDomainEvent, 'userId' | 'itemKey'>): Promise<void> {
    await this.bus.publish(
      { userId: event.userId },
      { type: 'inboxMark.changed', itemKey: event.itemKey },
    );
  }
}
