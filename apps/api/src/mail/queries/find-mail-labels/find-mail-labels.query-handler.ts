import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import type { GmailLabel } from '../../infrastructure/gmail-provider.port';
import { FindMailLabelsQuery } from './find-mail-labels.query';

@QueryHandler(FindMailLabelsQuery)
export class FindMailLabelsQueryHandler
  implements IQueryHandler<FindMailLabelsQuery, GmailLabel[]>
{
  constructor(private readonly gmail: GmailCallResolver) {}

  async execute({ scope, connectionId }: FindMailLabelsQuery): Promise<GmailLabel[]> {
    const connection = await this.gmail.activeConnection(scope, connectionId);
    return this.gmail.call(connection, (provider, grant) => provider.listLabels(grant));
  }
}
