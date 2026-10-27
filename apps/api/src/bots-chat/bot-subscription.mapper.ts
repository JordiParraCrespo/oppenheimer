import { Injectable } from '@nestjs/common';
import { BOT_SESSION_WAKE_STATES, botDefaultModel, SCOPES, type Scope } from '@oppenheimer/shared';
import type { BotEntity } from '../bots/domain/bot.entity';
import type { WorkSessionEntity } from '../sessions/domain/work-session.entity';
import { BotSubscriptionOrmEntity } from './database/bot-subscription.orm-entity';
import { BotSubscriptionEntity } from './domain/bot-subscription.entity';
import {
  BOT_SUBSCRIPTION_UNTIL,
  BOT_SUBSCRIPTION_WAKE_LIMIT,
  type BotSubscriptionUntil,
  type BotWatchFrom,
  knownStateOf,
  type SessionWake,
  type sessionWakeTurn,
  type WakeDecision,
  type WatchedTask,
  watchedTurnFor,
} from './domain/bot-subscription.policy';
import { formatToolTime } from './domain/bot-tool-text.policy';

/**
 * A bot's subscription between its row and the aggregate, and as its watch
 * tools word it; no route reads it yet.
 */
@Injectable()
export class BotSubscriptionMapper {
  toPersistence(entity: BotSubscriptionEntity): BotSubscriptionOrmEntity {
    const record = new BotSubscriptionOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.resourceKind = entity.resourceKind;
    record.resourceId = entity.resourceId;
    record.originTurnId = entity.originTurnId;
    record.purpose = entity.purpose;
    record.until = entity.until;
    record.watchedTurn = entity.watchedTurn;
    record.credentialScopes = entity.credentialScopes ? [...entity.credentialScopes] : null;
    record.timeZone = entity.timeZone;
    record.lastTurn = entity.lastTurn;
    record.lastState = entity.lastState;
    record.wakes = entity.wakes;
    record.version = entity.versionAtLoad;
    return record;
  }

  toDomain(record: BotSubscriptionOrmEntity): BotSubscriptionEntity {
    const lastState = BOT_SESSION_WAKE_STATES.find((known) => known === record.lastState) ?? null;
    return BotSubscriptionEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        // The table's CHECK holds it to the one kind there is.
        resourceKind: 'session',
        resourceId: record.resourceId,
        originTurnId: record.originTurnId,
        purpose: record.purpose,
        until: BOT_SUBSCRIPTION_UNTIL.find((known) => known === record.until) ?? 'task',
        watchedTurn: record.watchedTurn,
        credentialScopes: record.credentialScopes ? scopesOf(record.credentialScopes) : null,
        timeZone: record.timeZone,
        lastTurn: lastState ? record.lastTurn : null,
        lastState,
        wakes: record.wakes,
        version: record.version,
      },
    });
  }

  /**
   * A new subscription from the turn that asked for it and the session as it
   * stands. One the bot made by starting the session, or by prompting it,
   * follows that task and knows none of it yet, however far it got before
   * the watch was stored; one made later follows the live task, or the next,
   * and counts what the bot can already read as told.
   */
  toSubscribeProps(
    asker: {
      organizationId: string;
      botId: string;
      turnId: string;
      credentialScopes: readonly Scope[] | null;
      timeZone: string;
    },
    session: WorkSessionEntity,
    options: { until: BotSubscriptionUntil; purpose: string | null; from: BotWatchFrom },
  ): Parameters<typeof BotSubscriptionEntity.subscribe>[0] {
    const latest = session.latestTurn;
    const from = options.from;
    const known = from === 'now';
    return {
      organizationId: asker.organizationId,
      botId: asker.botId,
      sessionId: session.id,
      originTurnId: asker.turnId,
      purpose: options.purpose,
      until: options.until,
      watchedTurn: from === 'first_task' ? 1 : from === 'now' ? watchedTurnFor(latest) : from.turn,
      credentialScopes: asker.credentialScopes,
      timeZone: asker.timeZone,
      known: known ? knownStateOf(latest) : null,
    };
  }

  /**
   * The turn a wake queues, as the bot's owner on the bot's engine as it is
   * now, with the scopes and zone of the turn that subscribed.
   */
  toWakeTurnProps(
    subscription: BotSubscriptionEntity,
    bot: BotEntity,
    ownerUserId: string,
  ): Parameters<typeof sessionWakeTurn>[0] {
    return {
      organizationId: subscription.organizationId,
      botId: bot.id,
      requestedByUserId: ownerUserId,
      provider: bot.provider,
      model: bot.model ?? botDefaultModel(bot.provider).id,
      effort: bot.effort,
      timeZone: subscription.timeZone,
      credentialScopes: subscription.credentialScopes,
    };
  }

  /** What a wake tells the bot, from the subscription, the session read now and the decision. */
  toWake(
    subscription: BotSubscriptionEntity,
    session: WorkSessionEntity,
    task: WatchedTask,
    decision: Extract<WakeDecision, { kind: 'wake' }>,
  ): SessionWake {
    return {
      subscriptionId: subscription.id,
      sessionId: session.id,
      sessionName: session.name,
      purpose: subscription.purpose,
      task,
      state: decision.state,
      ends: decision.ends,
    };
  }

  /** What `watch_session` answers: what is followed now, and what the session is doing. */
  toWatchAnswer(subscription: BotSubscriptionEntity, session: WorkSessionEntity): string {
    const latest = session.latestTurn;
    const now = latest
      ? `Its latest task (#${latest.seq}) is ${latest.state}.`
      : 'It has no task yet.';
    const follows =
      subscription.until === 'task'
        ? `task #${subscription.watchedTurn}${latest && subscription.watchedTurn !== latest.seq ? ' (its next one)' : ''}, until it ends`
        : 'every task, until the session is closed';
    return `You follow session ${session.id} "${session.name}": ${follows}. ${now} You will be woken when a task you follow needs input, finishes, fails or is stopped; end your turn now rather than wait for it.`;
  }

  /** One line of `list_watches`. */
  toListLine(subscription: BotSubscriptionEntity, timeZone: string): string {
    const until =
      subscription.until === 'task' ? `task #${subscription.watchedTurn}` : 'until closed';
    const parts = [
      until,
      `woke you ${subscription.wakes} of ${BOT_SUBSCRIPTION_WAKE_LIMIT} times`,
      subscription.lastState
        ? `last: task #${subscription.lastTurn} ${subscription.lastState}`
        : null,
      `since ${formatToolTime(subscription.createdAt, timeZone)}`,
    ].filter(Boolean);
    const purpose = subscription.purpose ? ` — ${subscription.purpose}` : '';
    return `session ${subscription.resourceId} [${parts.join('; ')}]${purpose}`;
  }
}

/** The stored scopes, keeping only those the catalog still knows. */
function scopesOf(stored: readonly string[]): Scope[] {
  return stored.filter((scope): scope is Scope => (SCOPES as readonly string[]).includes(scope));
}
