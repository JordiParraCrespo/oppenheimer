import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SessionWakeRequestedDomainEvent } from '../../domain/events/session-wake-requested.domain-event';
import { scheduledWakeText, wakeAt, wakeIds } from '../../domain/session-wake.policy';
import { SESSION_WAKES } from '../../sessions.di-tokens';
import type { SessionWakesPort } from '../session-wakes.port';

/**
 * A session's agent asked to be woken at a time (`wake.requested`): stage the
 * wake for then, on the same durable queue a pull request's wake rides
 * (`product/next-steps/agent-tools.md` §4). A time already past wakes it now;
 * one further than a week from when it was asked is held to a week, which
 * the runner refuses before it ever gets here. Delivered at least once by the
 * outbox: a second job for the same wake types nothing, since the prompt is
 * claimed by the wake's id.
 */
@Injectable()
export class SessionWakeRequestedDomainEventHandler {
  constructor(@Inject(SESSION_WAKES) private readonly wakes: SessionWakesPort) {}

  // `suppressErrors: false`: by default Nest logs a listener's rejection and
  // the outbox marks the event delivered, so a wake whose stage failed would
  // be lost after the agent was told to end its turn; rethrown, the outbox
  // delivers the event again.
  @OnEvent(SessionWakeRequestedDomainEvent.name, { suppressErrors: false })
  async handle(
    event: Pick<
      SessionWakeRequestedDomainEvent,
      'aggregateId' | 'wakeId' | 'at' | 'text' | 'metadata'
    >,
  ): Promise<void> {
    const at = wakeAt(event.at, Date.now());
    if (!at) return;
    await this.wakes.schedule(
      {
        sessionId: event.aggregateId,
        wakeId: wakeIds.schedule(event.wakeId),
        source: 'schedule',
        text: scheduledWakeText(event.wakeId, event.text),
        attempt: 0,
      },
      at,
      event.metadata.correlationId ?? null,
    );
  }
}
