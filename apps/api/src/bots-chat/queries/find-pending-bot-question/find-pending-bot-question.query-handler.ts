import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BOT_QUESTION_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotQuestionRepositoryPort } from '../../database/bot-question.repository.port';
import type { BotQuestionEntity } from '../../domain/bot-question.entity';
import { FindPendingBotQuestionQuery } from './find-pending-bot-question.query';

/** The card of questions a bot has waiting, or none. A bot in another workspace is `BOTS_001`. */
@QueryHandler(FindPendingBotQuestionQuery)
export class FindPendingBotQuestionQueryHandler
  implements IQueryHandler<FindPendingBotQuestionQuery, BotQuestionEntity | null>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_QUESTION_REPOSITORY) private readonly questions: BotQuestionRepositoryPort,
  ) {}

  async execute({ scope, botId }: FindPendingBotQuestionQuery): Promise<BotQuestionEntity | null> {
    const bot = await this.lookup.bot(scope, botId);
    const pending = await this.questions.findPending(bot.organizationId, bot.id);
    return pending.isSome() ? pending.unwrap() : null;
  }
}
