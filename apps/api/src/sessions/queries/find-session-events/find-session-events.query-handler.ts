import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type {
  SessionEventPage,
  WorkSessionRepositoryPort,
} from '../../database/work-session.repository.port';
import { SessionErrors } from '../../domain/sessions.errors';
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
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async execute(query: FindSessionEventsQuery): Promise<SessionEventPage> {
    const found = await this.sessions.findOneById(query.scope, query.sessionId);
    if (found.isNone()) {
      throw new AppError(SessionErrors.NOT_FOUND, {
        detail: `No session with id ${query.sessionId}`,
      });
    }
    return this.sessions.findEvents(found.unwrap(), query.afterSeq, query.limit);
  }
}
