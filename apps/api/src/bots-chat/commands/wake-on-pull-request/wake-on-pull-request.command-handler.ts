import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotSessionWakeResolver } from '../../application/bot-session-wake.resolver';
import { BotSubscriptionSubjectResolver } from '../../application/bot-subscription-subject.resolver';
import { BotSubscriptionMapper } from '../../bot-subscription.mapper';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';
import {
  pullRequestWakeFor,
  pullRequestWakeOf,
  pullRequestWakeTurn,
} from '../../domain/bot-pull-request-wake.policy';
import { WakeOnPullRequestCommand } from './wake-on-pull-request.command';

/**
 * An event on a pull request a bot follows (`27-bot-subscriptions.md` §7).
 * The bot and its owner are resolved again, as for any wake; the pull
 * request is not re-read, since GitHub is not ours to read as the owner on
 * every event: the wake is the event's metadata. It is the one wake path
 * (`BotSessionWakeResolver.queueTurn`), keyed by the subscription and the
 * stored event, so an event delivered twice queues one turn, and only a turn
 * queued now is counted against the wake limit. A merge ends the
 * subscription after its wake.
 */
@CommandHandler(WakeOnPullRequestCommand)
export class WakeOnPullRequestCommandHandler
  implements ICommandHandler<WakeOnPullRequestCommand, void>
{
  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    private readonly subjects: BotSubscriptionSubjectResolver,
    private readonly mapper: BotSubscriptionMapper,
    private readonly wakes: BotSessionWakeResolver,
  ) {}

  async execute(command: WakeOnPullRequestCommand): Promise<void> {
    const subscription = await this.subscriptions.findForWake(command.subscriptionId);
    const pullRequest = subscription?.pullRequest;
    if (!subscription || !pullRequest) return;
    const acting = await this.subjects.resolveOwner(subscription);
    if (!acting) return this.wakes.end(subscription, 'access_lost');

    const decision = pullRequestWakeFor(subscription.wakes, command.type);
    if (decision.kind === 'end') return this.wakes.end(subscription, decision.reason);

    const wake = pullRequestWakeOf(
      { id: subscription.id, purpose: subscription.purpose, pullRequest },
      decision.ends,
      {
        inboundEventId: command.inboundEventId,
        type: command.type,
        attributes: command.attributes,
        actorLogin: command.actorLogin,
      },
    );
    const built = pullRequestWakeTurn(
      this.mapper.toWakeTurnProps(subscription, acting.bot, acting.ownerUserId),
      wake,
    );
    const queued = await this.wakes.queueTurn(
      subscription,
      acting,
      built,
      command.metadata.correlationId,
    );
    if (queued === 'missing') return;
    if (decision.ends) return this.wakes.end(subscription, 'delivered');
    if (queued === 'existing') return;
    subscription.recordPullRequestWake();
    // A loser was beaten by another wake of the same subscription, which recorded its own.
    await this.subscriptions.recordWake(subscription);
  }
}
