import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { MembershipAccessPolicy } from '../../application/membership-access.policy';
import type { WorkspaceLookupPort } from '../../application/workspace-lookup.port';
import type { InvitationRepositoryPort } from '../../database/invitation.repository.port';
import type { Invitation, InvitationCaller } from '../../domain/invitation.types';
import type { InvitationResponseDto } from '../../dtos/organization.response.dto';
import type { InvitationAuthPort } from '../../infrastructure/invitation-auth.port';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import {
  INVITATION_AUTH,
  INVITATION_REPOSITORY,
  ORGANIZATION_AUTH,
  WORKSPACE_LOOKUP,
} from '../../organizations.di-tokens';
import { AcceptInvitationCommand } from './accept-invitation.command';

/**
 * Accepts an invitation the caller was sent, and grants the application role
 * its organization role stands for — Better Auth owns membership roles, CASL
 * owns what the app allows, and both halves are aligned at the moment the
 * membership is created, scoped to the organization so an org admin never
 * becomes a platform-wide one.
 *
 * Accepting twice is safe: a retry after Better Auth committed the membership
 * but a later step failed finishes the job instead of failing on an invitation
 * that is no longer pending.
 */
@CommandHandler(AcceptInvitationCommand)
export class AcceptInvitationCommandHandler
  implements ICommandHandler<AcceptInvitationCommand, InvitationResponseDto>
{
  constructor(
    @Inject(INVITATION_AUTH)
    private readonly invitationAuth: InvitationAuthPort,
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
    @Inject(INVITATION_REPOSITORY)
    private readonly invitations: InvitationRepositoryPort,
    @Inject(WORKSPACE_LOOKUP)
    private readonly workspaces: WorkspaceLookupPort,
    private readonly membershipAccess: MembershipAccessPolicy,
  ) {}

  async execute(command: AcceptInvitationCommand): Promise<InvitationResponseDto> {
    const replayed = await this.acceptedByCaller(command.invitationId, command.caller);
    if (replayed && command.caller) {
      await this.organizations.setActive(command.headers, replayed.organizationId);
      await this.grant(command.caller.id, replayed);
      return replayed;
    }

    const { invitation, userId } = await this.invitationAuth.accept(
      command.headers,
      command.invitationId,
    );
    await this.grant(userId, invitation);
    return invitation;
  }

  /**
   * The invitation, when it is already accepted and the caller is who accepted
   * it. Recipient email plus the membership it created prove the caller is
   * replaying their own acceptance, not claiming someone else's.
   */
  private async acceptedByCaller(
    invitationId: string,
    caller: InvitationCaller | null,
  ): Promise<Invitation | null> {
    if (!caller) return null;
    const found = await this.invitations.findOneById(invitationId);
    if (found.isNone()) return null;

    const invitation = found.unwrap();
    if (invitation.status !== 'accepted') return null;
    if (invitation.email.toLowerCase() !== caller.email.toLowerCase()) return null;

    const isMember = await this.workspaces.isMember(invitation.organizationId, caller.id);
    return isMember ? invitation : null;
  }

  private grant(userId: string, invitation: Invitation): Promise<void> {
    return this.membershipAccess.grant(
      userId,
      invitation.organizationId,
      invitation.role ?? 'member',
    );
  }
}
