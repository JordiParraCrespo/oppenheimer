import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { FindSessionQuery } from './find-session.query';

@QueryHandler(FindSessionQuery)
export class FindSessionQueryHandler implements IQueryHandler<FindSessionQuery, WorkSessionEntity> {
  constructor(private readonly loader: SessionLoaderResolver) {}

  async execute(query: FindSessionQuery): Promise<WorkSessionEntity> {
    return this.loader.find(query.scope, query.sessionId);
  }
}
