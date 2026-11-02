import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ExternalEventReceivedDomainEvent } from '../../../inbound-events/domain/events/external-event-received.domain-event';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { githubWakeText, isWakingGithubEvent } from '../../domain/session-wake.policy';
import { SESSION_WAKES, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import type { SessionWakesPort } from '../session-wakes.port';

/**
 * A GitHub event on a pull request: wake the open sessions in its workspace
 * whose agent asked to be woken by that pull request (`pull.watched`,
 * `product/next-steps/agent-tools.md` §3). Each gets one wake, keyed by the
 * stored event, so the outbox's redelivery wakes nobody twice. Our own app's
 * events wake nobody: they are what the sessions did.
 */
@Injectable()
export class GithubPullWakesDomainEventHandler {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_WAKES)
    private readonly wakes: SessionWakesPort,
  ) {}

  @OnEvent(ExternalEventReceivedDomainEvent.name)
  async handle(
    event: Pick<
      ExternalEventReceivedDomainEvent,
      | 'aggregateId'
      | 'organizationId'
      | 'source'
      | 'eventType'
      | 'subjectRef'
      | 'actorLogin'
      | 'actorIsOwnApp'
      | 'attributes'
      | 'metadata'
    >,
  ): Promise<void> {
    if (event.source !== 'github' || event.actorIsOwnApp) return;
    if (!isWakingGithubEvent(event.eventType)) return;
    const number = event.attributes?.number;
    if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) return;
    if (event.attributes?.isPullRequest === false) return;
    const watching = await this.sessions.findWatchingPullForSystem(
      event.organizationId,
      event.subjectRef,
      number,
    );
    const text = githubWakeText(
      event.eventType,
      number,
      event.attributes ?? {},
      event.actorLogin ?? null,
    );
    for (const session of watching) {
      await this.wakes.schedule(
        {
          sessionId: session.id,
          wakeId: `gh-${event.aggregateId}`,
          source: 'github',
          text,
          attempt: 0,
        },
        new Date(),
        event.metadata.correlationId ?? null,
      );
    }
  }
}
