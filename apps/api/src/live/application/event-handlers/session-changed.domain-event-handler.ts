import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SessionCreatedDomainEvent } from '../../../sessions/domain/events/session-created.domain-event';
import { SessionStateChangedDomainEvent } from '../../../sessions/domain/events/session-state-changed.domain-event';
import { SessionTurnChangedDomainEvent } from '../../../sessions/domain/events/session-turn-changed.domain-event';
import { LIVE_EVENTS } from '../../live.di-tokens';
import type { LiveEventsPort } from '../live-events.port';

type SessionEvent = Pick<SessionStateChangedDomainEvent, 'aggregateId' | 'organizationId'>;

/**
 * A session's row moved for every console of its workspace: it was created,
 * its lifecycle moved, or its agent's turn did. These are what the session list
 * and a session's screen draw, and what the console polled for.
 *
 * A publish that fails is logged and dropped rather than retried: the outbox
 * would deliver this event again, and every other listener of it with it, to
 * save a refetch the console makes anyway on its next dial.
 */
@Injectable()
export class SessionChangedDomainEventHandler {
  private readonly logger = new Logger(SessionChangedDomainEventHandler.name);

  constructor(@Inject(LIVE_EVENTS) private readonly live: LiveEventsPort) {}

  @OnEvent(SessionCreatedDomainEvent.name)
  @OnEvent(SessionStateChangedDomainEvent.name)
  @OnEvent(SessionTurnChangedDomainEvent.name)
  async handle(event: SessionEvent): Promise<void> {
    try {
      await this.live.publish(event.organizationId, {
        type: 'session.changed',
        sessionId: event.aggregateId,
      });
    } catch (error) {
      this.logger.warn({
        message: 'Could not publish a session change',
        sessionId: event.aggregateId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
