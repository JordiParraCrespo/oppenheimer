import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { HasOpenSessionsQuery } from './has-open-sessions.query';

/**
 * Counts, through the caller's own scope, the sessions in a project that the fold
 * has not moved to `resolved`.
 *
 * `starting` and `failed` count as open: a launch that never finished and a session
 * that fell over both still have a directory on somebody's host, and retiring the
 * project's directory out from under either is exactly what the refusal exists for.
 */
@QueryHandler(HasOpenSessionsQuery)
export class HasOpenSessionsQueryHandler implements IQueryHandler<HasOpenSessionsQuery, boolean> {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async execute(query: HasOpenSessionsQuery): Promise<boolean> {
    const open = await this.sessions.countUnresolvedForProject(query.scope, query.projectId);
    return open > 0;
  }
}
