import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotGoalResolver } from '../../application/bot-goal.resolver';
import { BOT_GOAL_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotGoalRepositoryPort } from '../../database/bot-goal.repository.port';
import { ClearBotGoalCommand } from './clear-bot-goal.command';

/**
 * Stop a bot's goal from its chat (`25-bots.md` §4.1): the goal ends with a
 * line saying the owner stopped it, and a continuation still waiting is
 * cancelled with it (`BotGoalResolver`). A running one finishes its turn;
 * with the goal gone, its end queues nothing. No goal is no error.
 */
@CommandHandler(ClearBotGoalCommand)
export class ClearBotGoalCommandHandler implements ICommandHandler<ClearBotGoalCommand, void> {
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_GOAL_REPOSITORY) private readonly goals: BotGoalRepositoryPort,
    private readonly goalsOf: BotGoalResolver,
  ) {}

  async execute({ scope, botId, metadata }: ClearBotGoalCommand): Promise<void> {
    const bot = await this.lookup.bot(scope, botId);
    const goal = await this.goals.findForBot(bot.organizationId, bot.id);
    if (!goal) return;
    await this.goalsOf.end(goal, { activity: 'cleared', reason: null }, metadata.correlationId);
  }
}
