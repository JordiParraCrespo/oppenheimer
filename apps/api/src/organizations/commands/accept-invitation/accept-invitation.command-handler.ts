import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { MembershipAccessPolicy } from '../../application/membership-access.policy';
import type { WorkspaceLookupPort } from '../../application/workspace-lookup.port';
import type { InvitationRepositoryPort } from '../../database/invitation.repository.port';
import type { Invitation, InvitationCaller } from '../../domain/invitation.types';
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
 * Accepts an invitation the caller was sent, with the application role its
 * organization role stands for — scoped to the organization, so an org admin
 * never becomes a platform-wide one — or not at all: a membership whose role
 * cannot be granted is left again. Answers the invitation's id.
 *
 * Accepting twice is safe. A retry whose first attempt Better Auth committed
 * (the response was lost, or selecting the organization failed) finds the
 * invitation accepted and the caller a member, and finishes the job instead of
 * failing on an invitation that is no longer pending.
 */
@CommandHandler(AcceptInvitationCommand)
export class AcceptInvitationCommandHandler
  implements ICommandHandler<AcceptInvitationCommand, AggregateID>
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

  async execute({ headers, invitationId, caller }: AcceptInvitationCommand): Promise<AggregateID> {
    const replayed = await this.acceptedByCaller(invitationId, caller);
    if (replayed && caller) {
      await this.organizations.setActive(headers, replayed.organizationId);
      // The membership predates this request, so there is nothing to undo.
      await this.membershipAccess.admit(
        async () => rosterEntry(caller.id, replayed),
        async () => {},
      );
      return replayed.id;
    }

    const { invitation } = await this.membershipAccess.admit(
      async () => {
        const accepted = await this.invitationAuth.accept(headers, invitationId);
        return {
          ...rosterEntry(accepted.userId, accepted.invitation),
          invitation: accepted.invitation,
        };
      },
      (entry) => this.organizations.leave(headers, entry.organizationId),
    );
    return invitation.id;
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
}

/** The membership an invitation makes: its organization, in the role it names. */
function rosterEntry(userId: string, invitation: Invitation) {
  return { userId, organizationId: invitation.organizationId, role: invitation.role ?? 'member' };
}
