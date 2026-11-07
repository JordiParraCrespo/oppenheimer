import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotSessionWakeResolver } from '../../application/bot-session-wake.resolver';
import { BotSubscriptionSubjectResolver } from '../../application/bot-subscription-subject.resolver';
import { BotSubscriptionMapper } from '../../bot-subscription.mapper';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';
import {
  BOT_SUBSCRIPTION_WAKE_LIMIT,
  noticeWakeFor,
  noticeWakeOf,
  sessionWakeTurn,
} from '../../domain/bot-subscription.policy';
import { WakeOnAgentNoticeCommand } from './wake-on-agent-notice.command';

/**
 * A session a bot follows had its agent send a line (`runner sessions
 * notify`, `product/next-steps/agent-tools.md` §9): the agent's way of
 * speaking to whoever follows its work, which a bot hears as a wake. The
 * session is read again as the bot's owner, and the notice it holds now is
 * the one quoted, never words carried on the event: one the session no longer
 * holds (a newer one replaced it, the session closed) wakes nothing, and the
 * newer one wakes for itself. It is the one wake path
 * (`BotSessionWakeResolver.queueTurn`), keyed by the subscription and the
 * notice's id, so a notice delivered twice queues one turn; the wake is taken
 * from the limit first, in one statement, and given back when nothing was
 * queued. The words are the agent's: the wake fences them as data, and
 * anything the bot does about them asks first as it always would.
 */
@CommandHandler(WakeOnAgentNoticeCommand)
export class WakeOnAgentNoticeCommandHandler
  implements ICommandHandler<WakeOnAgentNoticeCommand, void>
{
  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    private readonly subjects: BotSubscriptionSubjectResolver,
    private readonly mapper: BotSubscriptionMapper,
    private readonly wakes: BotSessionWakeResolver,
  ) {}

  async execute(command: WakeOnAgentNoticeCommand): Promise<void> {
    const subscription = await this.subscriptions.findForWake(command.subscriptionId);
    if (!subscription || subscription.resourceKind !== 'session') return;
    const subject = await this.subjects.resolve(subscription);
    if (!subject) return this.wakes.end(subscription, 'access_lost');
    const notice = subject.session.notice;
    if (subject.session.isResolved || notice?.id !== command.noticeId) return;

    const claimed = await this.subscriptions.claimWake(
      subscription.id,
      BOT_SUBSCRIPTION_WAKE_LIMIT,
    );
    const decision = noticeWakeFor(claimed);
    if (decision.kind === 'end') return this.wakes.end(subscription, decision.reason);

    const wake = noticeWakeOf(subscription, subject.session, notice, decision.ends);
    const built = sessionWakeTurn(
      this.mapper.toWakeTurnProps(subscription, subject.bot, subject.ownerUserId),
      wake,
    );
    const queued = await this.wakes.queueTurn(
      subscription,
      subject,
      built,
      command.metadata.correlationId,
    );
    if (queued !== 'queued') await this.subscriptions.releaseWake(subscription.id);
    if (queued !== 'missing' && decision.ends) await this.wakes.end(subscription, 'wake_limit');
  }
}
