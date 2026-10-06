import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SessionCreatedDomainEvent } from '../../../sessions/domain/events/session-created.domain-event';
import { SessionStateChangedDomainEvent } from '../../../sessions/domain/events/session-state-changed.domain-event';
import { SessionTurnChangedDomainEvent } from '../../../sessions/domain/events/session-turn-changed.domain-event';
import { LIVE_EVENTS } from '../../live.di-tokens';
import type { LiveEventsPort } from '../live-events.port';

/**
 * A session was created, or its lifecycle or its agent's turn moved: what the
 * session list and a session's screen draw.
 */
@Injectable()
export class SessionChangedDomainEventHandler {
  constructor(@Inject(LIVE_EVENTS) private readonly live: LiveEventsPort) {}

  @OnEvent(SessionCreatedDomainEvent.name)
  @OnEvent(SessionStateChangedDomainEvent.name)
  @OnEvent(SessionTurnChangedDomainEvent.name)
  handle(event: Pick<SessionStateChangedDomainEvent, 'aggregateId' | 'organizationId'>) {
    return this.live.publish(event.organizationId, {
      type: 'session.changed',
      sessionId: event.aggregateId,
    });
  }
}
