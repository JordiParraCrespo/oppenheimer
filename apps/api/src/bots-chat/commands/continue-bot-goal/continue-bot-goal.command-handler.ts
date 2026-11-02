import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotGoalResolver } from '../../application/bot-goal.resolver';
import { BotGoalReviewResolver } from '../../application/bot-goal-review.resolver';
import { BOT_GOAL_REPOSITORY, BOT_STREAM, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotGoalRepositoryPort } from '../../database/bot-goal.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { goalContinuationTurn, goalDecision, goalOutcome } from '../../domain/bot-goal.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { ContinueBotGoalCommand } from './continue-bot-goal.command';

/**
 * A turn of a goal ended (`25-bots.md` §4.1): load, decide (`goalDecision`),
 * ask the reviewer whether the condition holds (`BotGoalReviewResolver`),
 * decide again on its verdict (`goalOutcome`), act. The goal is read again
 * after the review, which takes a model call: one ended or replaced
 * meanwhile (the bot's `end_goal`, the owner's Stop, a new `/goal`) is left
 * as it is. Going on queues the next continuation as the bot's owner, and the
 * goal's count is claimed in the same transaction as the queued turn, so a
 * Stop that deleted the goal meanwhile queues nothing, and a process that dies
 * leaves either both or neither. Ending goes through `BotGoalResolver`.
 */
@CommandHandler(ContinueBotGoalCommand)
export class ContinueBotGoalCommandHandler
  implements ICommandHandler<ContinueBotGoalCommand, void>
{
  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_GOAL_REPOSITORY) private readonly goals: BotGoalRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly goalsOf: BotGoalResolver,
    private readonly reviewer: BotGoalReviewResolver,
  ) {}

  async execute({ turnId, metadata }: ContinueBotGoalCommand): Promise<void> {
    const found = await this.turns.findForRun(turnId);
    if (found.isNone() || !found.unwrap().endedAt) return;
    const ended = found.unwrap();
    const goal = await this.goals.findForBot(ended.organizationId, ended.botId);
    if (!goal) return;

    const decision = goalDecision(goal, ended);
    if (decision.kind === 'skip') return;
    if (decision.kind === 'end') {
      const ending = { activity: decision.activity, reason: decision.reason };
      await this.goalsOf.end(goal, ending, metadata.correlationId);
      return;
    }
    const verdict = await this.reviewer.review(goal, ended.id);
    const current = await this.goals.findForBot(goal.organizationId, goal.botId);
    if (current?.id !== goal.id) return;
    const outcome = goalOutcome(current, verdict);
    const props =
      outcome.kind === 'continue' ? await this.goalsOf.continuationProps(current) : null;
    if (!props) {
      const ending =
        outcome.kind === 'end'
          ? { activity: outcome.activity, reason: outcome.reason }
          : { activity: 'stopped' as const, reason: 'access_lost' };
      await this.goalsOf.end(current, ending, metadata.correlationId);
      return;
    }

    const { turn, opening } = goalContinuationTurn(
      props,
      current,
      current.advance(),
      outcome.reason,
    );
    const queued = await this.turns.enqueueContinuation(
      turn,
      opening,
      metadata.correlationId,
      current,
    );
    if (queued === 'staged' || queued === 'waiting') {
      await this.stream.publish(turn.botId, { type: 'turn', turnId: turn.id, status: 'queued' });
    }
  }
}
