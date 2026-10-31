import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CloudSessionSyncResolver } from '../../application/cloud-session-sync.resolver';
import type {
  SessionListPage,
  WorkSessionRepositoryPort,
} from '../../database/work-session.repository.port';
import { decodeSessionListCursor } from '../../domain/session-list-cursor.policy';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { FindSessionsQuery } from './find-sessions.query';

/**
 * A page of sessions. The page's working cloud sessions are brought up to
 * date with their vendors first, a few at a time (`CloudSessionSyncResolver`),
 * so the list a poll reads moves when a vendor's run does.
 */
@QueryHandler(FindSessionsQuery)
export class FindSessionsQueryHandler implements IQueryHandler<FindSessionsQuery, SessionListPage> {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    private readonly cloud: CloudSessionSyncResolver,
  ) {}

  async execute(query: FindSessionsQuery): Promise<SessionListPage> {
    const sort = query.sort ?? 'recent';
    const page = await this.sessions.findAllPaginated(query.scope, {
      page: query.page,
      limit: query.limit,
      projectId: query.projectId,
      hostId: query.hostId,
      state: query.state,
      githubRepoId: query.githubRepoId,
      agent: query.agent,
      sort,
      // A cursor issued for another sort, or not by this list at all, is a 400.
      cursor: query.cursor ? decodeSessionListCursor(query.cursor, sort) : undefined,
    });
    await this.cloud.syncPage(page.data, new Date());
    return page;
  }
}
