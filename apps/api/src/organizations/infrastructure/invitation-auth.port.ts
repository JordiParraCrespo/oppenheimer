import type { IncomingHttpHeaders } from 'node:http';
import type { InviteMemberDto } from '@oppenheimer/shared';
import type { InvitationResponseDto } from '../dtos/organization.response.dto';

/** An accepted invitation, and the account whose membership it created. */
export interface AcceptedInvitation {
  invitation: InvitationResponseDto;
  userId: string;
}

/**
 * What the invitation use cases need from the identity provider, which owns
 * the `invitation` table and checks that the caller may issue an invitation,
 * or is the one it was sent to, from the incoming request's headers.
 *
 * The lists answer pending invitations only: the provider keeps a cancelled or
 * answered one as a row with another status, and nobody asking for "the
 * invitations" means those.
 */
export interface InvitationAuthPort {
  invite(
    headers: IncomingHttpHeaders,
    organizationId: string,
    input: InviteMemberDto,
  ): Promise<InvitationResponseDto>;
  accept(headers: IncomingHttpHeaders, invitationId: string): Promise<AcceptedInvitation>;
  reject(headers: IncomingHttpHeaders, invitationId: string): Promise<InvitationResponseDto>;
  cancel(headers: IncomingHttpHeaders, invitationId: string): Promise<InvitationResponseDto>;
  get(headers: IncomingHttpHeaders, invitationId: string): Promise<InvitationResponseDto>;
  listForOrganization(
    headers: IncomingHttpHeaders,
    organizationId: string,
  ): Promise<InvitationResponseDto[]>;
  listForCaller(headers: IncomingHttpHeaders): Promise<InvitationResponseDto[]>;
}
