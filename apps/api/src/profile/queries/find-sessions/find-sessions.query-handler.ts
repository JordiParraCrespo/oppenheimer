import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { OwnedSession, SessionReaderPort } from '../../database/session.repository.port';
import { SESSION_READER } from '../../profile.di-tokens';
import { FindSessionsQuery } from './find-sessions.query';

/** The caller's live sessions. Read-only — revoking goes through a command. */
@QueryHandler(FindSessionsQuery)
export class FindSessionsQueryHandler implements IQueryHandler<FindSessionsQuery, OwnedSession[]> {
  constructor(
    @Inject(SESSION_READER)
    private readonly sessions: SessionReaderPort,
  ) {}

  async execute(query: FindSessionsQuery): Promise<OwnedSession[]> {
    return this.sessions.findActiveByUserId(query.userId);
  }
}
