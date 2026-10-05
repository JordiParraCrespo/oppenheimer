import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { InvitationResponseDto } from '../../dtos/organization.response.dto';
import type { InvitationAuthPort } from '../../infrastructure/invitation-auth.port';
import { INVITATION_AUTH } from '../../organizations.di-tokens';
import { ListOrganizationInvitationsQuery } from './list-organization-invitations.query';

/** An organization's pending invitations. */
@QueryHandler(ListOrganizationInvitationsQuery)
export class ListOrganizationInvitationsQueryHandler
  implements IQueryHandler<ListOrganizationInvitationsQuery, InvitationResponseDto[]>
{
  constructor(
    @Inject(INVITATION_AUTH)
    private readonly invitations: InvitationAuthPort,
  ) {}

  execute(query: ListOrganizationInvitationsQuery): Promise<InvitationResponseDto[]> {
    return this.invitations.listForOrganization(query.headers, query.organizationId);
  }
}
