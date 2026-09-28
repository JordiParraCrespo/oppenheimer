import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type {
  SessionEventPage,
  WorkSessionRepositoryPort,
} from '../../database/work-session.repository.port';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { FindSessionEventsQuery } from './find-session-events.query';

/**
 * The session is read first, under the caller's scope, and **that read is the
 * authorization**: `work_session_event` has no tenant column and no resource of its
 * own, because it is only ever reached through its session.
 */
@QueryHandler(FindSessionEventsQuery)
export class FindSessionEventsQueryHandler
  implements IQueryHandler<FindSessionEventsQuery, SessionEventPage>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async execute(query: FindSessionEventsQuery): Promise<SessionEventPage> {
    const session = await this.loader.find(query.scope, query.sessionId);
    return this.sessions.findEvents(session, query.afterSeq, query.limit);
  }
}
