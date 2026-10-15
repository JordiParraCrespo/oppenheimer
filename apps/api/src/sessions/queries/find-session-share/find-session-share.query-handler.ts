import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { CredentialOwnerPort } from '../../../auth/application/credential-owner.port';
import { CREDENTIAL_OWNER } from '../../../auth/auth.di-tokens';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { SessionShareRepositoryPort } from '../../database/session-share.repository.port';
import { SESSION_SHARE_REPOSITORY } from '../../sessions.di-tokens';
import { FindSessionShareQuery, type FoundSessionShare } from './find-session-share.query';

/**
 * How a session is shared, or `null` when it is not; the session read in
 * scope first. An expired share is still answered, so the dialog can say
 * so; it opens nothing for a guest.
 */
@QueryHandler(FindSessionShareQuery)
export class FindSessionShareQueryHandler
  implements IQueryHandler<FindSessionShareQuery, FoundSessionShare | null>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(SESSION_SHARE_REPOSITORY)
    private readonly shares: SessionShareRepositoryPort,
    @Inject(CREDENTIAL_OWNER)
    private readonly owners: CredentialOwnerPort,
  ) {}

  async execute(query: FindSessionShareQuery): Promise<FoundSessionShare | null> {
    const session = await this.loader.find(query.scope, query.sessionId);
    const found = await this.shares.findOneBySession(session.organizationId, session.id);
    if (found.isNone()) return null;
    const share = found.unwrap();
    return { share, owner: await this.owners.findActiveOwner(share.sharedByUserId) };
  }
}
