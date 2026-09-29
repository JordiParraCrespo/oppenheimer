import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { InvitationResponseDto } from '../../dtos/organization.response.dto';
import type { InvitationAuthPort } from '../../infrastructure/invitation-auth.port';
import { INVITATION_AUTH } from '../../organizations.di-tokens';
import { ListMyInvitationsQuery } from './list-my-invitations.query';

/** The pending invitations addressed to the caller. */
@QueryHandler(ListMyInvitationsQuery)
export class ListMyInvitationsQueryHandler
  implements IQueryHandler<ListMyInvitationsQuery, InvitationResponseDto[]>
{
  constructor(
    @Inject(INVITATION_AUTH)
    private readonly invitations: InvitationAuthPort,
  ) {}

  execute(query: ListMyInvitationsQuery): Promise<InvitationResponseDto[]> {
    return this.invitations.listForCaller(query.headers);
  }
}
