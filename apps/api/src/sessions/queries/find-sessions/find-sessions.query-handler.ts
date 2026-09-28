import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type {
  SessionListPage,
  WorkSessionRepositoryPort,
} from '../../database/work-session.repository.port';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { WorkSessionMapper } from '../../work-session.mapper';
import { FindSessionsQuery } from './find-sessions.query';

@QueryHandler(FindSessionsQuery)
export class FindSessionsQueryHandler implements IQueryHandler<FindSessionsQuery, SessionListPage> {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    private readonly mapper: WorkSessionMapper,
  ) {}

  async execute(query: FindSessionsQuery): Promise<SessionListPage> {
    const sort = query.sort ?? 'recent';
    return this.sessions.findAllPaginated(query.scope, {
      page: query.page,
      limit: query.limit,
      projectId: query.projectId,
      hostId: query.hostId,
      state: query.state,
      githubRepoId: query.githubRepoId,
      agent: query.agent,
      sort,
      // A cursor issued for another sort, or not by this list at all, is a 400.
      cursor: query.cursor ? this.mapper.fromListCursor(query.cursor, sort) : undefined,
    });
  }
}
