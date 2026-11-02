import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BOT_GOAL_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotGoalRepositoryPort } from '../../database/bot-goal.repository.port';
import type { BotGoalEntity } from '../../domain/bot-goal.entity';
import { FindBotGoalQuery } from './find-bot-goal.query';

/** A bot's goal, open now, or none (`25-bots.md` §4.1). A bot in another workspace is `BOTS_001`. */
@QueryHandler(FindBotGoalQuery)
export class FindBotGoalQueryHandler
  implements IQueryHandler<FindBotGoalQuery, BotGoalEntity | null>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_GOAL_REPOSITORY) private readonly goals: BotGoalRepositoryPort,
  ) {}

  async execute({ scope, botId }: FindBotGoalQuery): Promise<BotGoalEntity | null> {
    const bot = await this.lookup.bot(scope, botId);
    return this.goals.findForBot(bot.organizationId, bot.id);
  }
}
