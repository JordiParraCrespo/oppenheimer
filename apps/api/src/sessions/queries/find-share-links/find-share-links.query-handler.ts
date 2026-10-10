import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { SessionShareLinkRepositoryPort } from '../../database/session-share-link.repository.port';
import type { SessionShareLinkEntity } from '../../domain/session-share-link.entity';
import { SESSION_SHARE_LINK_REPOSITORY } from '../../sessions.di-tokens';
import { FindShareLinksQuery } from './find-share-links.query';

/** A session's links, live and not, newest first; the session read in scope first. */
@QueryHandler(FindShareLinksQuery)
export class FindShareLinksQueryHandler
  implements IQueryHandler<FindShareLinksQuery, SessionShareLinkEntity[]>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(SESSION_SHARE_LINK_REPOSITORY)
    private readonly links: SessionShareLinkRepositoryPort,
  ) {}

  async execute(query: FindShareLinksQuery): Promise<SessionShareLinkEntity[]> {
    const session = await this.loader.find(query.scope, query.sessionId);
    return this.links.findBySession(session.organizationId, session.id);
  }
}
