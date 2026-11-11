import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type {
  SessionSearchMatch,
  WorkSessionRepositoryPort,
} from '../../database/work-session.repository.port';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { SearchSessionsQuery } from './search-sessions.query';

/**
 * No controller: a bot's `search_sessions` is its reader. The search reads
 * only the sessions the caller's scope admits, as every list does, so a bot
 * finds its owner's workspace and nothing else.
 */
@QueryHandler(SearchSessionsQuery)
export class SearchSessionsQueryHandler
  implements IQueryHandler<SearchSessionsQuery, SessionSearchMatch[]>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  execute({ scope, criteria }: SearchSessionsQuery): Promise<SessionSearchMatch[]> {
    return this.sessions.search(scope, criteria);
  }
}
