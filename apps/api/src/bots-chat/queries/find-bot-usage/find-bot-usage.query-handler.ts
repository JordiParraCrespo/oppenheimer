import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { BotUsage } from '@oppenheimer/shared';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BOT_USAGE_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotUsageRepositoryPort } from '../../database/bot-usage.repository.port';
import { FindBotUsageQuery } from './find-bot-usage.query';

/**
 * What a bot's chat has spent (`25-bots.md` §4.1, `/usage`): its turns by
 * model and its calls outside them by purpose. A bot in another workspace is
 * `BOTS_001`.
 */
@QueryHandler(FindBotUsageQuery)
export class FindBotUsageQueryHandler implements IQueryHandler<FindBotUsageQuery, BotUsage> {
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_USAGE_REPOSITORY) private readonly usage: BotUsageRepositoryPort,
  ) {}

  async execute({ scope, botId }: FindBotUsageQuery): Promise<BotUsage> {
    const bot = await this.lookup.bot(scope, botId);
    return this.usage.findForBot(bot.organizationId, bot.id);
  }
}
