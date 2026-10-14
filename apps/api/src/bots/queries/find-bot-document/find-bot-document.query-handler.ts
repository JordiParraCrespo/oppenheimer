import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import { BotLookupResolver } from '../../application/bot-lookup.resolver';
import { BOT_DOCUMENT_REPOSITORY } from '../../bots.di-tokens';
import type { BotDocumentRepositoryPort } from '../../database/bot-document.repository.port';
import type { BotDocumentEntity } from '../../domain/bot-document.entity';
import { BotErrors } from '../../domain/bots.errors';
import { FindBotDocumentQuery } from './find-bot-document.query';

/** No route of its own: a save and a revert read their answer back through it. */
@QueryHandler(FindBotDocumentQuery)
export class FindBotDocumentQueryHandler
  implements IQueryHandler<FindBotDocumentQuery, BotDocumentEntity>
{
  constructor(
    private readonly lookup: BotLookupResolver,
    @Inject(BOT_DOCUMENT_REPOSITORY)
    private readonly documents: BotDocumentRepositoryPort,
  ) {}

  async execute({ scope, botId, name }: FindBotDocumentQuery): Promise<BotDocumentEntity> {
    const documentName = this.lookup.documentName(name);
    return requireFound(
      await this.documents.findOne(scope, botId, documentName),
      BotErrors.DOCUMENT_NOT_FOUND,
    );
  }
}
