import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BotLookupResolver } from '../../application/bot-lookup.resolver';
import { BOT_DOCUMENT_REPOSITORY } from '../../bots.di-tokens';
import type { BotDocumentRepositoryPort } from '../../database/bot-document.repository.port';
import type { BotDocumentRevision } from '../../domain/bot.types';
import { FindBotDocumentRevisionsQuery } from './find-bot-document-revisions.query';

/** A document's history, newest first: what the revisions list draws and a revert picks from. */
@QueryHandler(FindBotDocumentRevisionsQuery)
export class FindBotDocumentRevisionsQueryHandler
  implements IQueryHandler<FindBotDocumentRevisionsQuery, BotDocumentRevision[]>
{
  constructor(
    private readonly lookup: BotLookupResolver,
    @Inject(BOT_DOCUMENT_REPOSITORY)
    private readonly documents: BotDocumentRepositoryPort,
  ) {}

  async execute(query: FindBotDocumentRevisionsQuery): Promise<BotDocumentRevision[]> {
    const name = this.lookup.documentName(query.name);
    await this.lookup.bot(query.scope, query.botId);
    return this.documents.findRevisions(query.scope, query.botId, name, query.limit);
  }
}
