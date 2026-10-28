import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CloudSessionSyncResolver } from '../../application/cloud-session-sync.resolver';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { FindSessionQuery } from './find-session.query';

/** One session; a cloud session is first brought up to date with its vendor, on a budget. */
@QueryHandler(FindSessionQuery)
export class FindSessionQueryHandler implements IQueryHandler<FindSessionQuery, WorkSessionEntity> {
  constructor(
    private readonly loader: SessionLoaderResolver,
    private readonly cloud: CloudSessionSyncResolver,
  ) {}

  async execute(query: FindSessionQuery): Promise<WorkSessionEntity> {
    const session = await this.loader.find(query.scope, query.sessionId);
    await this.cloud.syncOne(session, new Date());
    return session;
  }
}
