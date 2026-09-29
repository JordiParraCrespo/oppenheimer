import type { IncomingHttpHeaders } from 'node:http';
import { Injectable } from '@nestjs/common';
import type { InviteMemberDto } from '@oppenheimer/shared';
import { auth } from '../../auth/infrastructure/better-auth.config';
import { asRecord, betterAuthHeaders, unwrap } from '../../auth/infrastructure/better-auth.util';
import type { InvitationResponseDto } from '../dtos/organization.response.dto';
import { OrganizationMapper } from '../organization.mapper';
import type { AcceptedInvitation, InvitationAuthPort } from './invitation-auth.port';
import { invokeOrganizationApi } from './organization-error.util';

/** The invitation port, over the Better Auth organization plugin's invitation endpoints. */
@Injectable()
export class InvitationAuthGateway implements InvitationAuthPort {
  async invite(
    headers: IncomingHttpHeaders,
    organizationId: string,
    input: InviteMemberDto,
  ): Promise<InvitationResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.createInvitation({
        body: {
          email: input.email,
          role: input.role,
          organizationId,
          teamId: input.teamId,
        },
        headers: betterAuthHeaders(headers),
      }),
    );
    return OrganizationMapper.toInvitation(result);
  }

  async accept(headers: IncomingHttpHeaders, invitationId: string): Promise<AcceptedInvitation> {
    const result = await invokeOrganizationApi(() =>
      auth.api.acceptInvitation({
        body: { invitationId },
        headers: betterAuthHeaders(headers),
      }),
    );
    return {
      invitation: OrganizationMapper.toInvitation(unwrap(result, 'invitation')),
      userId: String(asRecord(unwrap(result, 'member')).userId),
    };
  }

  async reject(headers: IncomingHttpHeaders, invitationId: string): Promise<InvitationResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.rejectInvitation({
        body: { invitationId },
        headers: betterAuthHeaders(headers),
      }),
    );
    return OrganizationMapper.toInvitation(unwrap(result, 'invitation'));
  }

  async cancel(headers: IncomingHttpHeaders, invitationId: string): Promise<InvitationResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.cancelInvitation({
        body: { invitationId },
        headers: betterAuthHeaders(headers),
      }),
    );
    return OrganizationMapper.toInvitation(result);
  }

  async get(headers: IncomingHttpHeaders, invitationId: string): Promise<InvitationResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.getInvitation({
        query: { id: invitationId },
        headers: betterAuthHeaders(headers),
      }),
    );
    return OrganizationMapper.toInvitation(result);
  }

  async listForOrganization(
    headers: IncomingHttpHeaders,
    organizationId: string,
  ): Promise<InvitationResponseDto[]> {
    const result = await invokeOrganizationApi(() =>
      auth.api.listInvitations({
        query: { organizationId },
        headers: betterAuthHeaders(headers),
      }),
    );
    return OrganizationMapper.toPendingInvitations(result);
  }

  async listForCaller(headers: IncomingHttpHeaders): Promise<InvitationResponseDto[]> {
    const result = await invokeOrganizationApi(() =>
      auth.api.listUserInvitations({ headers: betterAuthHeaders(headers) }),
    );
    return OrganizationMapper.toPendingInvitations(result);
  }
}
