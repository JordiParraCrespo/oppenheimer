import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotGoalResolver, type GoalContinuationProps } from '../../application/bot-goal.resolver';
import { BotGoalReviewResolver } from '../../application/bot-goal-review.resolver';
import {
  BOT_GOAL_REPOSITORY,
  BOT_MESSAGE_REPOSITORY,
  BOT_TURN_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type { BotGoalRepositoryPort } from '../../database/bot-goal.repository.port';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import type { BotGoalEntity } from '../../domain/bot-goal.entity';
import {
  continueOrStop,
  type GoalOutcome,
  goalDecision,
  goalOutcome,
  isGoalTurn,
  stoppedAtTurnLimit,
} from '../../domain/bot-goal.policy';
import type { BotTurnEntity } from '../../domain/bot-turn.entity';
import { ContinueBotGoalCommand } from './continue-bot-goal.command';

/**
 * A turn of a goal ended (`25-bots.md` §4.1): load, count what the turn spent
 * and whether it called a tool, decide (`goalDecision`), ask the reviewer
 * only when the bot claimed the goal met (`BotGoalReviewResolver`), act. The
 * goal is read again after the review, which takes a model call: one ended,
 * paused, replaced or moved on by another delivery of the same end meanwhile
 * is left as it is. Going on queues the next continuation as the bot's
 * owner, the goal's count claimed in the same transaction as the queued turn;
 * a pause is one conditional write with its line. Ending goes through
 * `BotGoalResolver`.
 */
@CommandHandler(ContinueBotGoalCommand)
export class ContinueBotGoalCommandHandler
  implements ICommandHandler<ContinueBotGoalCommand, void>
{
  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_GOAL_REPOSITORY) private readonly goals: BotGoalRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    private readonly goalsOf: BotGoalResolver,
    private readonly reviewer: BotGoalReviewResolver,
  ) {}

  async execute({ turnId, metadata }: ContinueBotGoalCommand): Promise<void> {
    const found = await this.turns.findForRun(turnId);
    if (found.isNone() || !found.unwrap().endedAt) return;
    const ended = found.unwrap();
    const goal = await this.goals.findForBot(ended.organizationId, ended.botId);
    if (!goal || !isGoalTurn(goal, ended) || goal.paused) return;
    goal.account({
      tokens: ended.inputTokens + ended.outputTokens,
      calledTools: await this.messages.turnCalledTools(ended.organizationId, ended.id),
    });

    const decision = goalDecision(goal, ended);
    if (decision.kind === 'skip') return;
    if (decision.kind === 'end') {
      await this.goalsOf.end(goal, decision, metadata.correlationId);
      return;
    }
    let outcome: GoalOutcome<GoalContinuationProps>;
    if (decision.kind === 'pause') {
      outcome = decision;
    } else if (decision.kind === 'review') {
      const verdict = await this.reviewer.review(goal, ended.id);
      // Still this goal at the count it was loaded at: another end, a Stop or
      // the owner may have moved it while the reviewer answered.
      const current = await this.goals.findForBot(goal.organizationId, goal.botId);
      if (current?.id !== goal.id || current.continuations !== goal.continuations) return;
      outcome = goalOutcome(goal, verdict, await this.goalsOf.continuationProps(goal));
    } else {
      outcome = continueOrStop(await this.goalsOf.continuationProps(goal), null);
    }
    await this.act(goal, ended, outcome, metadata.correlationId);
  }

  private async act(
    goal: BotGoalEntity,
    ended: BotTurnEntity,
    outcome: GoalOutcome<GoalContinuationProps>,
    correlationId: string,
  ): Promise<void> {
    if (outcome.kind === 'end') {
      await this.goalsOf.end(goal, outcome, correlationId);
      return;
    }
    if (outcome.kind === 'pause') {
      await this.goalsOf.pause(goal, outcome.reason, outcome.note);
      return;
    }
    await this.goalsOf.queueContinuation(
      goal,
      outcome.props,
      outcome.reason,
      stoppedAtTurnLimit(ended),
      correlationId,
    );
  }
}
