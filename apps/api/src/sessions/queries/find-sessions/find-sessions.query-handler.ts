import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Paginated } from '@oppenheimer/backend-ddd';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { FindSessionsQuery } from './find-sessions.query';

@QueryHandler(FindSessionsQuery)
export class FindSessionsQueryHandler
  implements IQueryHandler<FindSessionsQuery, Paginated<WorkSessionEntity>>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async execute(query: FindSessionsQuery): Promise<Paginated<WorkSessionEntity>> {
    return this.sessions.findAllPaginated(query.scope, {
      page: query.page,
      limit: query.limit,
      projectId: query.projectId,
      hostId: query.hostId,
      state: query.state,
      githubRepoId: query.githubRepoId,
      agent: query.agent,
      sort: query.sort,
    });
  }
}
