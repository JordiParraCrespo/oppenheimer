import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { type BotGoalActivity, botDefaultModel } from '@oppenheimer/shared';
import { BotModelAccessResolver } from '../../application/bot-model-access.resolver';
import { BotOwnerScopeResolver } from '../../application/bot-owner-scope.resolver';
import { BOT_GOAL_REPOSITORY, BOT_STREAM, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotGoalRepositoryPort } from '../../database/bot-goal.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import type { BotGoalEntity } from '../../domain/bot-goal.entity';
import {
  goalContinuationTurn,
  goalDecision,
  goalEndLine,
  goalKeyPrefix,
} from '../../domain/bot-goal.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { ContinueBotGoalCommand } from './continue-bot-goal.command';

/**
 * A goal goes on (`25-bots.md` §4.1): a turn of its bot ended, and the goal
 * still open queues its next continuation, as the bot's owner, with the
 * setting turn's reach. The turn is queued before the count is stored, so a
 * process that dies between the two queues nothing new on redelivery (the
 * key finds the turn) and stores the count then. A continuation already
 * waiting makes this end queue nothing: it will run, and its own end decides.
 */
@CommandHandler(ContinueBotGoalCommand)
export class ContinueBotGoalCommandHandler
  implements ICommandHandler<ContinueBotGoalCommand, void>
{
  private readonly logger = new Logger(ContinueBotGoalCommandHandler.name);

  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_GOAL_REPOSITORY) private readonly goals: BotGoalRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly access: BotModelAccessResolver,
    private readonly owners: BotOwnerScopeResolver,
  ) {}

  async execute({ turnId, metadata }: ContinueBotGoalCommand): Promise<void> {
    const found = await this.turns.findForRun(turnId);
    if (found.isNone()) return;
    const ended = found.unwrap();
    if (!ended.endedAt) return;
    const goal = await this.goals.findForBot(ended.organizationId, ended.botId);
    if (!goal) return;

    const decision = goalDecision(goal, ended);
    if (decision.kind === 'skip') return;
    if (decision.kind === 'end') return this.end(goal, decision.activity, decision.reason);

    const bot = await this.access.findBot(goal.organizationId, goal.botId);
    const ownerUserId = bot?.createdByUserId;
    const owner = ownerUserId ? await this.owners.resolve(goal.organizationId, ownerUserId) : null;
    if (!bot || !ownerUserId || !owner) return this.end(goal, 'stopped', 'access_lost');

    const step = goal.advance();
    const { turn, opening } = goalContinuationTurn(
      {
        organizationId: goal.organizationId,
        botId: bot.id,
        requestedByUserId: ownerUserId,
        provider: bot.provider,
        model: bot.model ?? botDefaultModel(bot.provider).id,
        effort: bot.effort,
        timeZone: goal.timeZone,
        credentialScopes: goal.credentialScopes,
      },
      goal,
      step,
    );
    const queued = await this.turns.enqueueOnce(
      turn,
      opening,
      metadata.correlationId,
      goalKeyPrefix(goal.id),
    );
    if (queued.outcome === 'busy' || queued.outcome === 'missing') return;
    if (queued.outcome === 'staged' || queued.outcome === 'waiting') {
      await this.stream.publish(bot.id, { type: 'turn', turnId: queued.turnId, status: 'queued' });
    }
    // A loser was beaten by another end that stored the same count.
    await this.goals.advance(goal);
  }

  private async end(
    goal: BotGoalEntity,
    activity: Exclude<BotGoalActivity, 'continued' | 'cleared'>,
    reason: string | null,
  ): Promise<void> {
    const line = goalEndLine(goal, activity, reason);
    if (!(await this.goals.end(goal, line))) return;
    await this.stream.publish(goal.botId, { type: 'message', turnId: null, messageId: line.id });
    this.logger.log({
      message: 'A bot goal ended',
      goalId: goal.id,
      botId: goal.botId,
      activity,
      reason,
    });
  }
}
