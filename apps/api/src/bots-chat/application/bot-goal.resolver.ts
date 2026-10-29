import { Inject, Injectable, Logger } from '@nestjs/common';
import { type BotGoalActivity, botDefaultModel } from '@oppenheimer/shared';
import { BOT_GOAL_REPOSITORY, BOT_STREAM, BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotGoalRepositoryPort } from '../database/bot-goal.repository.port';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import type { BotGoalEntity } from '../domain/bot-goal.entity';
import { type goalContinuationTurn, goalEndLine, goalKeyPrefix } from '../domain/bot-goal.policy';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';
import { BotModelAccessResolver } from './bot-model-access.resolver';
import { BotOwnerScopeResolver } from './bot-owner-scope.resolver';

/** How a goal ended, for its line; null when the call that ended it is the record. */
export type GoalEnding = {
  activity: Exclude<BotGoalActivity, 'continued'>;
  reason: string | null;
} | null;

/**
 * A bot's goal, as everything that ends or continues it shares it
 * (`25-bots.md` §4.1): an end is one write with its line, and the
 * continuations still waiting for that goal are cancelled with it, whoever
 * ended it (the bot's `end_goal`, a goal set in its place, the owner's Stop,
 * its limit, a failed turn). A continuation runs as the bot's owner.
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

  /** Ends the goal once, with its line, and cancels its waiting continuations; false when it had ended. */
  async end(
    goal: BotGoalEntity,
    ending: GoalEnding,
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
  async continuationProps(
    goal: BotGoalEntity,
  ): Promise<Parameters<typeof goalContinuationTurn>[0] | null> {
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
