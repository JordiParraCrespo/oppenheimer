import { Injectable } from '@nestjs/common';
import { BOT_SESSION_WAKE_STATES, botDefaultModel, SCOPES, type Scope } from '@oppenheimer/shared';
import type { BotEntity } from '../bots/domain/bot.entity';
import type { WorkSessionEntity } from '../sessions/domain/work-session.entity';
import { BotSubscriptionOrmEntity } from './database/bot-subscription.orm-entity';
import type { pullRequestWakeTurn } from './domain/bot-pull-request-wake.policy';
import { BotSubscriptionEntity, type PullRequestRef } from './domain/bot-subscription.entity';
import {
  BOT_SUBSCRIPTION_KINDS,
  BOT_SUBSCRIPTION_UNTIL,
  type BotSubscriptionUntil,
  type BotWatchFrom,
  type CheckFinding,
  type SessionWake,
  type sessionWakeTurn,
  type WakeDecision,
  type WatchedTask,
  watchStartOf,
} from './domain/bot-subscription.policy';
import { knownTaskEvents } from './domain/bot-task-wake.policy';

/**
 * A bot's subscription between its row and the aggregate, and what a wake is
 * told from it; no route reads it yet. How the watch tools word one is
 * `bot-watch-tool.mapper.ts`.
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
    record.githubRepoId = entity.pullRequest?.githubRepoId ?? null;
    record.pullNumber = entity.pullRequest?.number ?? null;
    record.repositoryFullName = entity.pullRequest?.repository ?? null;
    record.originTurnId = entity.originTurnId;
    record.purpose = entity.purpose;
    record.until = entity.until;
    record.watchedTurn = entity.watchedTurn;
    record.credentialScopes = entity.credentialScopes ? [...entity.credentialScopes] : null;
    record.timeZone = entity.timeZone;
    record.lastTurn = entity.lastTurn;
    record.lastState = entity.lastState;
    record.wakes = entity.wakes;
    record.terminalWatchId = entity.terminalWatch?.id ?? null;
    record.pattern = entity.terminalWatch?.pattern ?? null;
    record.matches = entity.matches;
    record.taskEvents = entity.taskEvents ? [...entity.taskEvents] : null;
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
        // CHK_bot_subscription_subject holds the columns to the kind.
        resourceKind:
          BOT_SUBSCRIPTION_KINDS.find((kind) => kind === record.resourceKind) ?? 'session',
        resourceId: record.resourceId,
        pullRequest:
          record.resourceKind === 'pull_request' &&
          record.githubRepoId !== null &&
          record.pullNumber !== null
            ? {
                githubRepoId: String(record.githubRepoId),
                number: record.pullNumber,
                repository: record.repositoryFullName ?? '',
              }
            : null,
        originTurnId: record.originTurnId,
        purpose: record.purpose,
        until: BOT_SUBSCRIPTION_UNTIL.find((known) => known === record.until) ?? 'task',
        watchedTurn: record.watchedTurn,
        credentialScopes: record.credentialScopes ? scopesOf(record.credentialScopes) : null,
        timeZone: record.timeZone,
        lastTurn: lastState ? record.lastTurn : null,
        lastState,
        wakes: record.wakes,
        terminalWatch:
          record.terminalWatchId && record.pattern
            ? { id: record.terminalWatchId, pattern: record.pattern }
            : null,
        matches: record.matches ?? 0,
        taskEvents: knownTaskEvents(record.taskEvents),
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
    const { watchedTurn, known } = watchStartOf(options.from, session.latestTurn);
    return {
      organizationId: asker.organizationId,
      botId: asker.botId,
      sessionId: session.id,
      originTurnId: asker.turnId,
      purpose: options.purpose,
      until: options.until,
      watchedTurn,
      credentialScopes: asker.credentialScopes,
      timeZone: asker.timeZone,
      known,
    };
  }

  /** A new pull request subscription from the turn that asked for it and the repository it resolved. */
  toPullRequestSubscribeProps(
    asker: Parameters<BotSubscriptionMapper['toSubscribeProps']>[0],
    pullRequest: PullRequestRef,
    purpose: string | null,
  ): Parameters<typeof BotSubscriptionEntity.subscribeToPullRequest>[0] {
    const { organizationId, botId, turnId, credentialScopes, timeZone } = asker;
    return {
      organizationId,
      botId,
      pullRequest,
      purpose,
      credentialScopes,
      timeZone,
      originTurnId: turnId,
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
  ): Parameters<typeof sessionWakeTurn>[0] & Parameters<typeof pullRequestWakeTurn>[0] {
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
      ...this.wakeOf(subscription, session, decision.ends),
      cause: {
        kind: 'state',
        task,
        state: decision.state,
        // A watch that never matched says so once its task is over.
        silentPattern:
          subscription.terminalWatch && subscription.matches === 0
            ? subscription.terminalWatch.pattern
            : null,
      },
    };
  }

  /** What a terminal match tells the bot: the subscription's watch, and the runner's count. */
  toMatchWake(
    subscription: BotSubscriptionEntity,
    session: WorkSessionEntity,
    watch: { id: string; pattern: string },
    count: number,
    ends: boolean,
  ): SessionWake {
    return {
      ...this.wakeOf(subscription, session, ends),
      cause: {
        kind: 'match',
        turn: session.latestTurn?.seq ?? 0,
        watchId: watch.id,
        pattern: watch.pattern,
        count,
      },
    };
  }

  private wakeOf(
    subscription: BotSubscriptionEntity,
    session: WorkSessionEntity,
    ends: boolean,
  ): Omit<SessionWake, 'cause'> {
    return {
      subscriptionId: subscription.id,
      sessionId: session.id,
      sessionName: session.name,
      purpose: subscription.purpose,
      ends,
    };
  }

  /** What a check of a handed-off task tells the bot: the task as read now, still followed. */
  toCheckWake(
    subscription: BotSubscriptionEntity,
    session: WorkSessionEntity,
    task: WatchedTask,
    finding: CheckFinding,
  ): SessionWake {
    return { ...this.wakeOf(subscription, session, false), cause: { ...finding, task } };
  }
}

/** The stored scopes, keeping only those the catalog still knows. */
function scopesOf(stored: readonly string[]): Scope[] {
  return stored.filter((scope): scope is Scope => (SCOPES as readonly string[]).includes(scope));
}
