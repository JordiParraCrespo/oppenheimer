import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import type { GmailThread } from '../../infrastructure/gmail-provider.port';
import { ReadMailThreadQuery } from './read-mail-thread.query';

/** Reads one thread of the caller's; reading it leaves it unread. */
@QueryHandler(ReadMailThreadQuery)
export class ReadMailThreadQueryHandler implements IQueryHandler<ReadMailThreadQuery, GmailThread> {
  constructor(private readonly gmail: GmailCallResolver) {}

  async execute({ scope, connectionId, threadId }: ReadMailThreadQuery): Promise<GmailThread> {
    const connection = await this.gmail.activeConnection(scope, connectionId);
    return this.gmail.call(connection, (provider, grant) => provider.readThread(grant, threadId));
  }
}
