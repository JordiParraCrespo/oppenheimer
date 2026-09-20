import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SessionErrors } from '../../domain/sessions.errors';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { FindSessionQuery } from './find-session.query';

@QueryHandler(FindSessionQuery)
export class FindSessionQueryHandler implements IQueryHandler<FindSessionQuery, WorkSessionEntity> {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async execute(query: FindSessionQuery): Promise<WorkSessionEntity> {
    const found = await this.sessions.findOneById(query.scope, query.sessionId);
    if (found.isNone()) {
      throw new AppError(SessionErrors.NOT_FOUND, {
        detail: `No session with id ${query.sessionId}`,
      });
    }
    return found.unwrap();
  }
}
