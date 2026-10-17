import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BotLookupResolver } from '../../application/bot-lookup.resolver';
import type { BotEntity } from '../../domain/bot.entity';
import { FindBotQuery } from './find-bot.query';

/** One bot; the bot writes read their answer back through it too. */
@QueryHandler(FindBotQuery)
export class FindBotQueryHandler implements IQueryHandler<FindBotQuery, BotEntity> {
  constructor(private readonly lookup: BotLookupResolver) {}

  async execute({ scope, botId }: FindBotQuery): Promise<BotEntity> {
    return this.lookup.bot(scope, botId);
  }
}
