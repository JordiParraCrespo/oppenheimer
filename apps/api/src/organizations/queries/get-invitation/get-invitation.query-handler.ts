import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { InvitationResponseDto } from '../../dtos/organization.response.dto';
import type { InvitationAuthPort } from '../../infrastructure/invitation-auth.port';
import { INVITATION_AUTH } from '../../organizations.di-tokens';
import { GetInvitationQuery } from './get-invitation.query';

/** One invitation the caller was sent. */
@QueryHandler(GetInvitationQuery)
export class GetInvitationQueryHandler
  implements IQueryHandler<GetInvitationQuery, InvitationResponseDto>
{
  constructor(
    @Inject(INVITATION_AUTH)
    private readonly invitations: InvitationAuthPort,
  ) {}

  execute(query: GetInvitationQuery): Promise<InvitationResponseDto> {
    return this.invitations.get(query.headers, query.invitationId);
  }
}
