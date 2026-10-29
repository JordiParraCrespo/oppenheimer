import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { GmailConnectionRepositoryPort } from '../../database/gmail-connection.repository.port';
import type { GmailConnectionEntity } from '../../domain/gmail-connection.entity';
import { GMAIL_CONNECTION_REPOSITORY } from '../../mail.di-tokens';
import { FindGmailConnectionsQuery } from './find-gmail-connections.query';

/** The caller's own Gmail accounts, oldest first; none is an empty list, not an error. */
@QueryHandler(FindGmailConnectionsQuery)
export class FindGmailConnectionsQueryHandler
  implements IQueryHandler<FindGmailConnectionsQuery, GmailConnectionEntity[]>
{
  constructor(
    @Inject(GMAIL_CONNECTION_REPOSITORY)
    private readonly connections: GmailConnectionRepositoryPort,
  ) {}

  async execute({ scope }: FindGmailConnectionsQuery): Promise<GmailConnectionEntity[]> {
    return this.connections.findAllOwn(scope);
  }
}
