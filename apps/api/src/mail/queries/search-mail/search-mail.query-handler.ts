import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import type { GmailSearchPage } from '../../infrastructure/gmail-provider.port';
import { SearchMailQuery } from './search-mail.query';

/** Searches one of the caller's Gmail accounts; nothing it finds is stored or marked read. */
@QueryHandler(SearchMailQuery)
export class SearchMailQueryHandler implements IQueryHandler<SearchMailQuery, GmailSearchPage> {
  constructor(private readonly gmail: GmailCallResolver) {}

  async execute({ scope, connectionId, request }: SearchMailQuery): Promise<GmailSearchPage> {
    const connection = await this.gmail.activeConnection(scope, connectionId);
    return this.gmail.call(connection, (provider, grant) => provider.search(grant, request));
  }
}
