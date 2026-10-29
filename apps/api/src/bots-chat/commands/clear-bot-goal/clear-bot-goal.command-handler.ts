import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BOT_GOAL_REPOSITORY, BOT_STREAM, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotGoalRepositoryPort } from '../../database/bot-goal.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { goalEndLine, goalKeyPrefix } from '../../domain/bot-goal.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { ClearBotGoalCommand } from './clear-bot-goal.command';

/**
 * Stop a bot's goal from its chat (`25-bots.md` §4.1): the goal ends with a
 * line saying the owner stopped it, and a continuation still waiting is
 * cancelled, since it exists only for the goal. A running one finishes its
 * turn; with the goal gone, its end queues nothing. No goal is no error.
 */
@CommandHandler(ClearBotGoalCommand)
export class ClearBotGoalCommandHandler implements ICommandHandler<ClearBotGoalCommand, void> {
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_GOAL_REPOSITORY) private readonly goals: BotGoalRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  async execute({ scope, botId, metadata }: ClearBotGoalCommand): Promise<void> {
    const bot = await this.lookup.bot(scope, botId);
    const goal = await this.goals.findForBot(bot.organizationId, bot.id);
    if (!goal) return;
    const line = goalEndLine(goal, 'cleared', null);
    if (!(await this.goals.end(goal, line))) return;
    await this.stream.publish(bot.id, { type: 'message', turnId: null, messageId: line.id });

    const waiting = await this.turns.findQueuedBySourcePrefix(
      bot.organizationId,
      bot.id,
      goalKeyPrefix(goal.id),
    );
    for (const turn of waiting) {
      turn.end('cancelled', new Date());
      if (await this.turns.finish(turn, metadata.correlationId)) {
        await this.stream.publish(bot.id, { type: 'turn', turnId: turn.id, status: 'cancelled' });
      }
    }
  }
}
