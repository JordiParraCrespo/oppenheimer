import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BOT_QUESTION_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotQuestionRepositoryPort } from '../../database/bot-question.repository.port';
import type { BotQuestionEntity } from '../../domain/bot-question.entity';
import { FindBotQuestionQuery } from './find-bot-question.query';

/** One card of questions of a bot in the caller's workspace: what an answer answers with. */
@QueryHandler(FindBotQuestionQuery)
export class FindBotQuestionQueryHandler
  implements IQueryHandler<FindBotQuestionQuery, BotQuestionEntity>
{
  constructor(
    @Inject(BOT_QUESTION_REPOSITORY) private readonly questions: BotQuestionRepositoryPort,
  ) {}

  async execute({ scope, botId, questionId }: FindBotQuestionQuery): Promise<BotQuestionEntity> {
    return requireFound(
      await this.questions.findOne(scope, botId, questionId),
      BotErrors.QUESTION_NOT_FOUND,
    );
  }
}
