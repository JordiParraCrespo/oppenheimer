import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BOT_LOOP_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotLoopRepositoryPort } from '../../database/bot-loop.repository.port';
import type { BotLoopEntity } from '../../domain/bot-loop.entity';
import { FindBotLoopQuery } from './find-bot-loop.query';

/** A bot's loop, open now, or none (`25-bots.md` §4.1, `/loop`). A bot in another workspace is `BOTS_001`. */
@QueryHandler(FindBotLoopQuery)
export class FindBotLoopQueryHandler
  implements IQueryHandler<FindBotLoopQuery, BotLoopEntity | null>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_LOOP_REPOSITORY) private readonly loops: BotLoopRepositoryPort,
  ) {}

  async execute({ scope, botId }: FindBotLoopQuery): Promise<BotLoopEntity | null> {
    const bot = await this.lookup.bot(scope, botId);
    return this.loops.findForBot(bot.organizationId, bot.id);
  }
}
