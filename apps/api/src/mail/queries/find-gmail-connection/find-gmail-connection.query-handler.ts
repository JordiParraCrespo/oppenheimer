import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { GmailConnectionRepositoryPort } from '../../database/gmail-connection.repository.port';
import type { GmailConnectionEntity } from '../../domain/gmail-connection.entity';
import { MailErrors } from '../../domain/mail.errors';
import { GMAIL_CONNECTION_REPOSITORY } from '../../mail.di-tokens';
import { FindGmailConnectionQuery } from './find-gmail-connection.query';

/** One of the caller's own Gmail accounts; someone else's, or none, is `MAIL_001`. */
@QueryHandler(FindGmailConnectionQuery)
export class FindGmailConnectionQueryHandler
  implements IQueryHandler<FindGmailConnectionQuery, GmailConnectionEntity>
{
  constructor(
    @Inject(GMAIL_CONNECTION_REPOSITORY)
    private readonly connections: GmailConnectionRepositoryPort,
  ) {}

  async execute({ scope, id }: FindGmailConnectionQuery): Promise<GmailConnectionEntity> {
    const found = await this.connections.findOwnById(scope, id);
    if (found.isNone()) throw new AppError(MailErrors.GMAIL_NOT_CONNECTED);
    return found.unwrap();
  }
}
