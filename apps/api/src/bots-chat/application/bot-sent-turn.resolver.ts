import { Inject, Injectable } from '@nestjs/common';
import { BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import { goalFromMessage } from '../domain/bot-goal.policy';
import { loopFromMessage } from '../domain/bot-loop.policy';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { BotGoalResolver } from './bot-goal.resolver';
import { BotLoopResolver } from './bot-loop.resolver';

/**
 * A sent message's turn, queued with what its built-in sets (`25-bots.md`
 * §4.1, "Built-in commands"): `/goal <condition>` sets the bot's goal and
 * `/loop …` its loop, in the transaction that queues the turn, so the turn
 * never runs, or ends, without it. What it replaced goes with the turn that
 * one left waiting. Any other message is queued as it is.
 */
@Injectable()
export class BotSentTurnResolver {
  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    private readonly goals: BotGoalResolver,
    private readonly loops: BotLoopResolver,
  ) {}

  async queue(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    correlationId: string | null,
  ): Promise<'staged' | 'waiting' | 'missing' | 'attachments_taken'> {
    const goal = goalFromMessage(message.content, turn);
    if (goal) {
      const { outcome, replaced } = await this.turns.enqueueWithGoal(
        turn,
        message,
        goal,
        correlationId,
      );
      if (replaced) await this.goals.cancelWaiting(replaced, correlationId);
      return outcome;
    }
    const loop = loopFromMessage(message.content, turn, new Date());
    if (loop) {
      const { outcome, replaced } = await this.turns.enqueueWithLoop(
        turn,
        message,
        loop,
        correlationId,
      );
      if (replaced) await this.loops.cancelWaiting(replaced, correlationId);
      return outcome;
    }
    return this.turns.enqueue(turn, message, correlationId);
  }
}
