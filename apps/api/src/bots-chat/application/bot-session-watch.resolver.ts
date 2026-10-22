import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import { FindSessionQuery } from '../../sessions/queries/find-session/find-session.query';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../database/bot-subscription.repository.port';
import { BotSubscriptionEntity } from '../domain/bot-subscription.entity';
import {
  BOT_SUBSCRIPTIONS_PER_BOT,
  type BotSubscriptionUntil,
  knownStateOf,
  watchedTurnFor,
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
  ) {}

  /**
   * Follows a session the bot just started, until its first task ends, and
   * says so in words for `start_session`'s answer. The session exists
   * whatever happens here, so a watch that cannot be stored is said, never
   * thrown: the start stays a start.
   */
  async watchStarted(context: BotToolCallContext, sessionId: string): Promise<string> {
    try {
      await this.watch(context, sessionId, { until: 'task', purpose: null });
      return 'You are subscribed to it and will be woken when its task needs input or ends: end your turn now, and report when you are.';
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return `It could not be watched (${reason}); read it later with get_session.`;
    }
  }

  async watch(
    context: BotToolCallContext,
    sessionId: string,
    options: { until: BotSubscriptionUntil; purpose: string | null; watchedTurn?: number },
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
    const latest = session.latestTurn;
    const subscription = await this.subscriptions.subscribe(
      BotSubscriptionEntity.subscribe({
        organizationId: context.organizationId,
        botId: context.botId,
        sessionId,
        originTurnId: context.turnId,
        purpose: options.purpose,
        until: options.until,
        watchedTurn: options.watchedTurn ?? watchedTurnFor(latest),
        credentialScopes: context.credentialScopes,
        timeZone: context.timeZone,
        known: knownStateOf(latest),
      }),
    );
    return { subscription, session };
  }
}
