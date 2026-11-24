import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BOT_FORM_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotFormRepositoryPort } from '../../database/bot-form.repository.port';
import type { BotFormEntity } from '../../domain/bot-form.entity';
import { FindBotFormQuery } from './find-bot-form.query';

/** One form of a bot in the caller's workspace: what a submission answers with. */
@QueryHandler(FindBotFormQuery)
export class FindBotFormQueryHandler implements IQueryHandler<FindBotFormQuery, BotFormEntity> {
  constructor(@Inject(BOT_FORM_REPOSITORY) private readonly forms: BotFormRepositoryPort) {}

  async execute({ scope, botId, formId }: FindBotFormQuery): Promise<BotFormEntity> {
    return requireFound(await this.forms.findOne(scope, botId, formId), BotErrors.FORM_NOT_FOUND);
  }
}
