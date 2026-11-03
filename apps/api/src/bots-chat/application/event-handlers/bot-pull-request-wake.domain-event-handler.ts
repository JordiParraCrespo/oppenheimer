import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import {
  isPullRequestWakeEvent,
  pullNumberOf,
} from '../../../github/domain/github-pull-event.policy';
import { ExternalEventReceivedDomainEvent } from '../../../inbound-events/domain/events/external-event-received.domain-event';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../../bots-chat.di-tokens';
import { WakeOnPullRequestCommand } from '../../commands/wake-on-pull-request/wake-on-pull-request.command';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';

/**
 * Where a GitHub event on a pull request reaches the bots that follow it
 * (`27-bot-subscriptions.md` §7): the subscriptions to that repository and
 * number in the event's workspace, each woken once per stored event. Our own
 * app's events wake nobody: they are what Oppenheimer did. The event carries
 * no comment's words, and none are read here.
 */
@Injectable()
export class BotPullRequestWakeDomainEventHandler {
  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    private readonly commands: CommandBus,
  ) {}

  // `suppressErrors: false`: by default Nest logs a listener's rejection and
  // resolves, so the outbox would mark the event delivered and a wake that
  // failed would never be tried again.
  @OnEvent(ExternalEventReceivedDomainEvent.name, { suppressErrors: false })
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
    const type = event.eventType;
    if (!isPullRequestWakeEvent(type)) return;
    const number = pullNumberOf(event.attributes);
    if (number === null || !/^[1-9]\d{0,18}$/.test(event.subjectRef)) return;
    const ids = await this.subscriptions.findIdsForPullRequest(
      event.organizationId,
      event.subjectRef,
      number,
    );
    // Each wake reads and decides on its own, so they run together, and one
    // that fails does not hold back the others; a failure is then thrown, for
    // the outbox to deliver the event again, and the wakes that went through
    // queue nothing new the second time.
    const settled = await Promise.allSettled(
      ids.map((subscriptionId) =>
        this.commands.execute(
          new WakeOnPullRequestCommand({
            subscriptionId,
            inboundEventId: event.aggregateId,
            type,
            attributes: event.attributes ?? {},
            actorLogin: event.actorLogin ?? null,
            metadata: { correlationId: event.metadata?.correlationId ?? undefined },
          }),
        ),
      ),
    );
    const failed = settled.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
  }
}
