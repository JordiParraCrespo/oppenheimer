import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { FindBranchSessionBotsQuery } from './find-branch-session-bots.query';

/** No controller: `automations` asks it on the bus when a GitHub event fires a routine. */
@QueryHandler(FindBranchSessionBotsQuery)
export class FindBranchSessionBotsQueryHandler
  implements IQueryHandler<FindBranchSessionBotsQuery, string[]>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  execute(query: FindBranchSessionBotsQuery): Promise<string[]> {
    return this.sessions.findBotsOnBranchForSystem(
      query.organizationId,
      query.githubRepoId,
      query.branch,
    );
  }
}
