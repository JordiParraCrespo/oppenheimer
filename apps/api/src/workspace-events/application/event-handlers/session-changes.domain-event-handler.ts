import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SessionUpdatedDomainEvent } from '../../../sessions/domain/events/session-updated.domain-event';
import { WORKSPACE_EVENT_BUS } from '../../workspace-events.di-tokens';
import type { WorkspaceEventBusPort } from '../workspace-event-bus.port';

/**
 * A session's row moved: tell its workspace's console. Every committed write
 * that lands log entries raises the event, so no write path can forget it.
 */
@Injectable()
export class SessionChangesDomainEventHandler {
  constructor(
    @Inject(WORKSPACE_EVENT_BUS)
    private readonly bus: WorkspaceEventBusPort,
  ) {}

  @OnEvent(SessionUpdatedDomainEvent.name)
  async handle(event: Pick<SessionUpdatedDomainEvent, 'aggregateId' | 'organizationId'>) {
    await this.bus.publish(
      { organizationId: event.organizationId },
      { type: 'session.changed', id: event.aggregateId },
    );
  }
}
