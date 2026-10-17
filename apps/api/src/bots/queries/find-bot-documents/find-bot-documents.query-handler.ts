import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BotLookupResolver } from '../../application/bot-lookup.resolver';
import { BOT_DOCUMENT_REPOSITORY } from '../../bots.di-tokens';
import type { BotDocumentRepositoryPort } from '../../database/bot-document.repository.port';
import type { BotDocumentEntity } from '../../domain/bot-document.entity';
import { FindBotDocumentsQuery } from './find-bot-documents.query';

/** Settings → Instructions: the soul and the instructions, each at its current revision. */
@QueryHandler(FindBotDocumentsQuery)
export class FindBotDocumentsQueryHandler
  implements IQueryHandler<FindBotDocumentsQuery, BotDocumentEntity[]>
{
  constructor(
    private readonly lookup: BotLookupResolver,
    @Inject(BOT_DOCUMENT_REPOSITORY)
    private readonly documents: BotDocumentRepositoryPort,
  ) {}

  async execute({ scope, botId }: FindBotDocumentsQuery): Promise<BotDocumentEntity[]> {
    await this.lookup.bot(scope, botId);
    return this.documents.findAll(scope, botId);
  }
}
