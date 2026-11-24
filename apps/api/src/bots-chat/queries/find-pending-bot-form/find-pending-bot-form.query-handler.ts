import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BOT_FORM_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotFormRepositoryPort } from '../../database/bot-form.repository.port';
import type { BotFormEntity } from '../../domain/bot-form.entity';
import { FindPendingBotFormQuery } from './find-pending-bot-form.query';

/** The form a bot has waiting, or none. A bot in another workspace is `BOTS_001`. */
@QueryHandler(FindPendingBotFormQuery)
export class FindPendingBotFormQueryHandler
  implements IQueryHandler<FindPendingBotFormQuery, BotFormEntity | null>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_FORM_REPOSITORY) private readonly forms: BotFormRepositoryPort,
  ) {}

  async execute({ scope, botId }: FindPendingBotFormQuery): Promise<BotFormEntity | null> {
    const bot = await this.lookup.bot(scope, botId);
    const pending = await this.forms.findPending(bot.organizationId, bot.id);
    return pending.isSome() ? pending.unwrap() : null;
  }
}
