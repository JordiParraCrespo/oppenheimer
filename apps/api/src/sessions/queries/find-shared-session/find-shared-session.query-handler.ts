import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { CredentialOwnerPort } from '../../../auth/application/credential-owner.port';
import { CREDENTIAL_OWNER } from '../../../auth/auth.di-tokens';
import { ShareLinkAccessResolver } from '../../application/share-link-access.resolver';
import type { SharedSessionResponseDto } from '../../dtos/session-share-link.response.dto';
import { SessionShareLinkMapper } from '../../session-share-link.mapper';
import { FindSharedSessionQuery } from './find-shared-session.query';

/**
 * What a link's holder sees before the terminal opens: the session's name,
 * whether it is running, what the link lets them do, and who shared it.
 * Nothing about the workspace, the project, the host or the repository.
 */
@QueryHandler(FindSharedSessionQuery)
export class FindSharedSessionQueryHandler
  implements IQueryHandler<FindSharedSessionQuery, SharedSessionResponseDto>
{
  constructor(
    private readonly access: ShareLinkAccessResolver,
    @Inject(CREDENTIAL_OWNER)
    private readonly owners: CredentialOwnerPort,
    private readonly mapper: SessionShareLinkMapper,
  ) {}

  async execute(query: FindSharedSessionQuery): Promise<SharedSessionResponseDto> {
    const { link, session } = await this.access.open(query.token, query.viewer);
    const owner = await this.owners.findActiveOwner(link.createdByUserId);
    return this.mapper.toSharedSession(link, session, owner);
  }
}
