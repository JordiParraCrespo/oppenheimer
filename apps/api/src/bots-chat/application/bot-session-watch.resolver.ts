import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { RequestContextService } from '@oppenheimer/backend-ddd';
import type { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import { FindSessionQuery } from '../../sessions/queries/find-session/find-session.query';
import { BotSubscriptionMapper } from '../bot-subscription.mapper';
import { BOT_STALL_CHECKS, BOT_SUBSCRIPTION_REPOSITORY } from '../bots-chat.di-tokens';
import { WakeSubscribedBotCommand } from '../commands/wake-subscribed-bot/wake-subscribed-bot.command';
import type { BotSubscriptionRepositoryPort } from '../database/bot-subscription.repository.port';
import { BotSubscriptionEntity } from '../domain/bot-subscription.entity';
import {
  BOT_STALL_CHECK_DELAY_MS,
  BOT_SUBSCRIPTIONS_PER_BOT,
  type BotSubscriptionUntil,
  type BotWatchFrom,
} from '../domain/bot-subscription.policy';
import type { BotStallChecksPort } from '../infrastructure/bot-stall-checks.port';
import { type BotToolCallContext, BotToolRefusal } from './bot-tool.factory';

/** What `start_session` and `send_to_session` answer once the task they handed off is followed. */
const HANDED_OFF =
  'You are subscribed to it and will be woken when the task needs input or ends, or if it has not got going in a few minutes: end your turn now, and report when you are.';

/** What a watch came to: the subscription as stored, and the session as it stood. */
export interface SessionWatch {
  subscription: BotSubscriptionEntity;
  session: WorkSessionEntity;
}

/**
 * A bot starts following a session (`27-bot-subscriptions.md` §3), from
 * `start_session` or `watch_session`: the session read as the owner, so a
 * bot follows only what its owner may read, and the subscription stored
 * with the turn that made it, its scopes and its zone. A task the bot hands
 * off also gets its silent stall check (§4.1).
 */
@Injectable()
export class BotSessionWatchResolver {
  private readonly logger = new Logger(BotSessionWatchResolver.name);

  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    @Inject(BOT_STALL_CHECKS) private readonly stallChecks: BotStallChecksPort,
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
    private readonly mapper: BotSubscriptionMapper,
  ) {}

  /**
   * Follows a session the bot just started, from its first task, and says so
   * in words for `start_session`'s answer. The task may already have ended
   * by the time the watch is stored (a launch that failed at once), and its
   * event then found nobody, so the wake is asked for once now: it reads the
   * session and wakes the bot if there is news, and does nothing otherwise.
   * The session exists whatever happens here, so a watch that cannot be
   * stored is said, never thrown: the start stays a start.
   */
  watchStarted(context: BotToolCallContext, sessionId: string): Promise<string> {
    return this.followHandOff(context, sessionId, 'first_task', 1);
  }

  /**
   * Follows the task a bot's follow-up prompt opened, by its number, and
   * says so in words for `send_to_session`'s answer. Like
   * {@link watchStarted}, the task may already have ended or blocked by the
   * time the watch is stored, so the wake is asked for once now; and a watch
   * that cannot be stored is said, never thrown: the prompt was sent.
   */
  watchSent(context: BotToolCallContext, sessionId: string, turn: number): Promise<string> {
    return this.followHandOff(context, sessionId, { turn }, turn);
  }

  /** Store the watch, ask for its wake once now, owe it its stall check, and say so. */
  private async followHandOff(
    context: BotToolCallContext,
    sessionId: string,
    from: BotWatchFrom,
    turn: number,
  ): Promise<string> {
    try {
      const { subscription } = await this.watch(context, sessionId, {
        until: 'task',
        purpose: null,
        from,
      });
      await this.commands.execute(
        new WakeSubscribedBotCommand({ subscriptionId: subscription.id }),
      );
      await this.checkLater(subscription, turn);
      return HANDED_OFF;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return `It could not be watched (${reason}); read it later with get_session.`;
    }
  }

  /**
   * Owes the task its stall check. The watch is stored either way, and its
   * wakes still come, so a check that cannot be staged is logged, not said.
   */
  private async checkLater(subscription: BotSubscriptionEntity, turn: number): Promise<void> {
    try {
      await this.stallChecks.schedule(
        {
          subscriptionId: subscription.id,
          botId: subscription.botId,
          sessionId: subscription.resourceId,
          turn,
        },
        new Date(Date.now() + BOT_STALL_CHECK_DELAY_MS),
        RequestContextService.getCorrelationId() ?? null,
      );
    } catch (error) {
      this.logger.warn(
        { message: 'A stall check could not be staged', subscriptionId: subscription.id, turn },
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async watch(
    context: BotToolCallContext,
    sessionId: string,
    options: { until: BotSubscriptionUntil; purpose: string | null; from: BotWatchFrom },
  ): Promise<SessionWatch> {
    const session = await this.queries.execute<FindSessionQuery, WorkSessionEntity>(
      new FindSessionQuery({ scope: context.owner, sessionId }),
    );
    if (session.isResolved) {
      throw new BotToolRefusal(`Session ${sessionId} is closed: there is nothing left to follow.`);
    }
    const existing = await this.subscriptions.findForBot(
      context.organizationId,
      context.botId,
      BOT_SUBSCRIPTIONS_PER_BOT,
    );
    const already = existing.some((subscription) => subscription.resourceId === sessionId);
    if (!already && existing.length >= BOT_SUBSCRIPTIONS_PER_BOT) {
      throw new BotToolRefusal(
        `You already follow ${BOT_SUBSCRIPTIONS_PER_BOT} sessions. Unwatch one you no longer need (list_watches shows them) first.`,
      );
    }
    const subscription = await this.subscriptions.subscribe(
      BotSubscriptionEntity.subscribe(this.mapper.toSubscribeProps(context, session, options)),
    );
    return { subscription, session };
  }
}
