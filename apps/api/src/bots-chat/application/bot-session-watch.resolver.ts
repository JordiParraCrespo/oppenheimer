import { Inject, Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import { FindSessionQuery } from '../../sessions/queries/find-session/find-session.query';
import { BotSubscriptionMapper } from '../bot-subscription.mapper';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../bots-chat.di-tokens';
import { WakeSubscribedBotCommand } from '../commands/wake-subscribed-bot/wake-subscribed-bot.command';
import type { BotSubscriptionRepositoryPort } from '../database/bot-subscription.repository.port';
import { BotSubscriptionEntity } from '../domain/bot-subscription.entity';
import {
  BOT_SUBSCRIPTIONS_PER_BOT,
  type BotSubscriptionUntil,
} from '../domain/bot-subscription.policy';
import { type BotToolCallContext, BotToolRefusal } from './bot-tool.factory';

/** What a watch came to: the subscription as stored, and the session as it stood. */
export interface SessionWatch {
  subscription: BotSubscriptionEntity;
  session: WorkSessionEntity;
}

/**
 * A bot starts following a session (`27-bot-subscriptions.md` §3), from
 * `start_session` or `watch_session`: the session read as the owner, so a
 * bot follows only what its owner may read, and the subscription stored
 * with the turn that made it, its scopes and its zone.
 */
@Injectable()
export class BotSessionWatchResolver {
  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
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
  async watchStarted(context: BotToolCallContext, sessionId: string): Promise<string> {
    try {
      const { subscription } = await this.watch(context, sessionId, {
        until: 'task',
        purpose: null,
        from: 'first_task',
      });
      await this.commands.execute(
        new WakeSubscribedBotCommand({ subscriptionId: subscription.id }),
      );
      return 'You are subscribed to it and will be woken when its task needs input or ends: end your turn now, and report when you are.';
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return `It could not be watched (${reason}); read it later with get_session.`;
    }
  }

  /**
   * Follows the task a bot's follow-up prompt opened, and says so in words
   * for `send_to_session`'s answer. Like {@link watchStarted}, a watch that
   * cannot be stored is said, never thrown: the prompt was sent.
   */
  async watchSent(context: BotToolCallContext, sessionId: string): Promise<string> {
    try {
      await this.watch(context, sessionId, { until: 'task', purpose: null, from: 'now' });
      return 'You are subscribed to it and will be woken when the task needs input or ends: end your turn now, and report when you are.';
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return `It could not be watched (${reason}); read it later with get_session.`;
    }
  }

  async watch(
    context: BotToolCallContext,
    sessionId: string,
    options: { until: BotSubscriptionUntil; purpose: string | null; from: 'first_task' | 'now' },
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
