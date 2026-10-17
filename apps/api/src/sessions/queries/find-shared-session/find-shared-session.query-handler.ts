import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { CredentialOwnerPort } from '../../../auth/application/credential-owner.port';
import { CREDENTIAL_OWNER } from '../../../auth/auth.di-tokens';
import { SessionShareAccessResolver } from '../../application/session-share-access.resolver';
import type { SharedSessionResponseDto } from '../../dtos/session-share.response.dto';
import { SessionShareMapper } from '../../session-share.mapper';
import { FindSharedSessionQuery } from './find-shared-session.query';

/**
 * What a guest sees before the terminal opens: the session's name, whether
 * it is running, what the share lets them do, until when, and who shared it.
 * Nothing about the workspace, the project, the host or the repository.
 */
@QueryHandler(FindSharedSessionQuery)
export class FindSharedSessionQueryHandler
  implements IQueryHandler<FindSharedSessionQuery, SharedSessionResponseDto>
{
  constructor(
    private readonly access: SessionShareAccessResolver,
    @Inject(CREDENTIAL_OWNER)
    private readonly owners: CredentialOwnerPort,
    private readonly mapper: SessionShareMapper,
  ) {}

  async execute(query: FindSharedSessionQuery): Promise<SharedSessionResponseDto> {
    const { share, session } = await this.access.open(query.slug, query.viewer);
    const owner = await this.owners.findActiveOwner(share.sharedByUserId);
    return this.mapper.toSharedSession(share, session, owner);
  }
}
