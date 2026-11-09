import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BotGoalPauseReason } from '@oppenheimer/shared';
import { botDefaultModel } from '@oppenheimer/shared';
import { BOT_GOAL_REPOSITORY, BOT_STREAM, BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotGoalRepositoryPort } from '../database/bot-goal.repository.port';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import type { BotGoalEntity } from '../domain/bot-goal.entity';
import {
  type GoalEnding,
  goalContinuationTurn,
  goalEndLine,
  goalKeyPrefix,
  goalPauseLine,
} from '../domain/bot-goal.policy';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';
import { BotModelAccessResolver } from './bot-model-access.resolver';
import { BotOwnerScopeResolver } from './bot-owner-scope.resolver';

/** What a goal's continuation turn is queued as: the owner, the engine, the reach. */
export type GoalContinuationProps = Parameters<typeof goalContinuationTurn>[0];

/**
 * A bot's goal, as everything that ends, pauses, resumes or continues it
 * shares it (`25-bots.md` §4.1): an end or a pause is one write with its
 * line, and the continuations still waiting for that goal are cancelled with
 * it, whoever did it (the bot's `end_goal`, a goal set in its place, the
 * owner's Stop, a failed turn, the guards). A continuation runs as the bot's
 * owner.
 */
@Injectable()
export class BotGoalResolver {
  private readonly logger = new Logger(BotGoalResolver.name);

  constructor(
    @Inject(BOT_GOAL_REPOSITORY) private readonly goals: BotGoalRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly access: BotModelAccessResolver,
    private readonly owners: BotOwnerScopeResolver,
  ) {}

  /**
   * Sets the goal, in place of the one there is: the one it replaces goes
   * with its waiting continuation. Answers the goal replaced, if any.
   */
  async set(goal: BotGoalEntity): Promise<BotGoalEntity | null> {
    const replaced = await this.goals.set(goal);
    if (replaced) await this.cancelWaiting(replaced, null);
    return replaced;
  }

  /** Ends the goal once, with its line, and cancels its waiting continuations; false when it had ended. */
  async end(
    goal: BotGoalEntity,
    /** How it ended, for its line; null when the call that ended it is the record. */
    ending: GoalEnding | null,
    correlationId: string | null,
  ): Promise<boolean> {
    const line = ending ? goalEndLine(goal, ending.activity, ending.reason) : null;
    if (!(await this.goals.end(goal, line))) return false;
    if (line) {
      await this.stream.publish(goal.botId, { type: 'message', turnId: null, messageId: line.id });
    }
    await this.cancelWaiting(goal, correlationId);
    this.logger.log({
      message: 'A bot goal ended',
      goalId: goal.id,
      botId: goal.botId,
      activity: ending?.activity ?? 'completed',
      reason: ending?.reason ?? null,
    });
    return true;
  }

  /** Pauses the goal in place, with its line; false when another writer moved it first. */
  async pause(
    goal: BotGoalEntity,
    reason: BotGoalPauseReason,
    note: string | null,
  ): Promise<boolean> {
    goal.pause(reason, note, new Date());
    const line = goalPauseLine(goal, 'paused');
    // Only the end of a turn pauses here, after counting it: its spend is in this write.
    if (!(await this.goals.pause(goal, line, 'counted'))) return false;
    await this.stream.publish(goal.botId, { type: 'message', turnId: null, messageId: line.id });
    await this.cancelWaiting(goal, null);
    this.logger.log({ message: 'A bot goal paused', goalId: goal.id, botId: goal.botId, reason });
    return true;
  }

  /**
   * Queues the goal's next continuation as `props`, its count claimed in the
   * same transaction; `resumed` puts the owner's line before it. Answers
   * whether it was queued (false when the goal moved meanwhile).
   */
  async queueContinuation(
    goal: BotGoalEntity,
    props: GoalContinuationProps,
    reason: string | null,
    lastStoppedAtLimit: boolean,
    correlationId: string | null,
    resumed = false,
  ): Promise<boolean> {
    const { turn, opening } = goalContinuationTurn(
      props,
      goal,
      goal.advance(),
      reason,
      lastStoppedAtLimit,
    );
    const line = resumed ? goalPauseLine(goal, 'resumed') : null;
    const queued = await this.turns.enqueueContinuation(turn, opening, correlationId, goal, line);
    if (queued === 'lost') return false;
    if (line) {
      await this.stream.publish(goal.botId, { type: 'message', turnId: null, messageId: line.id });
    }
    if (queued === 'staged' || queued === 'waiting') {
      await this.stream.publish(turn.botId, { type: 'turn', turnId: turn.id, status: 'queued' });
    }
    return true;
  }

  /**
   * Resumes a goal whose pausing turn has not ended yet (the bot said blocked
   * and the owner resumed before the turn was over) in place: that turn's
   * end then counts it and goes on. False when its turn was counted already.
   */
  async resumeBeforeItsTurnEnds(goal: BotGoalEntity): Promise<boolean> {
    const line = goalPauseLine(goal, 'resumed');
    if (!(await this.goals.resumeOwed(goal, line))) return false;
    goal.resume();
    await this.stream.publish(goal.botId, { type: 'message', turnId: null, messageId: line.id });
    return true;
  }

  /** Cancels the goal's continuations still waiting: they exist only for it. */
  async cancelWaiting(goal: BotGoalEntity, correlationId: string | null): Promise<void> {
    const waiting = await this.turns.findQueuedBySourcePrefix(
      goal.organizationId,
      goal.botId,
      goalKeyPrefix(goal.id),
    );
    for (const turn of waiting) {
      turn.end('cancelled', new Date());
      if (await this.turns.finish(turn, correlationId)) {
        await this.stream.publish(goal.botId, {
          type: 'turn',
          turnId: turn.id,
          status: 'cancelled',
        });
      }
    }
  }

  /**
   * What a continuation is queued as: the bot's owner, on the bot's engine as
   * it is now, with the setting turn's reach; null when the bot or its owner
   * is gone from the workspace, which ends the goal.
   */
  async continuationProps(goal: BotGoalEntity): Promise<GoalContinuationProps | null> {
    const bot = await this.access.findBot(goal.organizationId, goal.botId);
    const ownerUserId = bot?.createdByUserId;
    if (!bot || !ownerUserId) return null;
    if (!(await this.owners.resolve(goal.organizationId, ownerUserId))) return null;
    return {
      organizationId: goal.organizationId,
      botId: bot.id,
      requestedByUserId: ownerUserId,
      provider: bot.provider,
      model: bot.model ?? botDefaultModel(bot.provider).id,
      effort: bot.effort,
      timeZone: goal.timeZone,
      credentialScopes: goal.credentialScopes,
    };
  }
}
