import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import {
  FindLatestSessionEventsQuery,
  type LatestSessionEvents,
} from './find-latest-session-events.query';

/**
 * No controller: a bot's `read_session` is its reader. As for the paged log,
 * the session is read first under the caller's scope, and that read is the
 * authorization.
 */
@QueryHandler(FindLatestSessionEventsQuery)
export class FindLatestSessionEventsQueryHandler
  implements IQueryHandler<FindLatestSessionEventsQuery, LatestSessionEvents>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async execute(query: FindLatestSessionEventsQuery): Promise<LatestSessionEvents> {
    const session = await this.loader.find(query.scope, query.sessionId);
    return { session, events: await this.sessions.findLatestEvents(session, query.limit) };
  }
}
