import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import type { GmailDraftPage } from '../../infrastructure/gmail-provider.port';
import { FindMailDraftsQuery } from './find-mail-drafts.query';

@QueryHandler(FindMailDraftsQuery)
export class FindMailDraftsQueryHandler
  implements IQueryHandler<FindMailDraftsQuery, GmailDraftPage>
{
  constructor(private readonly gmail: GmailCallResolver) {}

  async execute({
    scope,
    connectionId,
    maxResults,
    pageToken,
  }: FindMailDraftsQuery): Promise<GmailDraftPage> {
    const connection = await this.gmail.activeConnection(scope, connectionId);
    return this.gmail.call(connection, (provider, grant) =>
      provider.listDrafts(grant, { maxResults, pageToken }),
    );
  }
}
