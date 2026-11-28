import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import {
  MembershipAccessPolicy,
  type RosterEntry,
} from '../../application/membership-access.policy';
import type { InvitationRepositoryPort } from '../../database/invitation.repository.port';
import type { MemberRepositoryPort } from '../../database/member.repository.port';
import type { Invitation, InvitationCaller } from '../../domain/invitation.types';
import type { InvitationAuthPort } from '../../infrastructure/invitation-auth.port';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import {
  INVITATION_AUTH,
  INVITATION_REPOSITORY,
  MEMBER_REPOSITORY,
  ORGANIZATION_AUTH,
} from '../../organizations.di-tokens';
import { AcceptInvitationCommand } from './accept-invitation.command';

/**
 * Accepts an invitation the caller was sent, with the application role its
 * organization role stands for — scoped to the organization, so an org admin
 * never becomes a platform-wide one — or not at all: a membership whose role
 * cannot be granted is left again, and the invitation is pending again for a
 * retry. Answers the invitation's id.
 *
 * Accepting twice is safe. A retry whose first attempt Better Auth committed
 * (the response was lost, or selecting the organization failed) finds the
 * invitation accepted and the caller a member, and finishes the job instead of
 * failing on an invitation that is no longer pending. The replay grants the
 * role the member holds on the roster now, never the one the invitation
 * carried: an admin demoted since would otherwise get `owner` back by
 * accepting their old invitation again.
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
    @Inject(MEMBER_REPOSITORY)
    private readonly members: MemberRepositoryPort,
    private readonly membershipAccess: MembershipAccessPolicy,
  ) {}

  async execute({ headers, invitationId, caller }: AcceptInvitationCommand): Promise<AggregateID> {
    const replayed = await this.acceptedByCaller(invitationId, caller);
    if (replayed) {
      await this.organizations.setActive(headers, replayed.membership.organizationId);
      // The membership predates this request, so there is nothing to undo.
      await this.membershipAccess.admit(
        async () => replayed.membership,
        async () => {},
      );
      return replayed.invitationId;
    }

    const { invitation } = await this.membershipAccess.admit(
      async () => {
        const accepted = await this.invitationAuth.accept(headers, invitationId);
        return {
          ...rosterEntry(accepted.userId, accepted.invitation),
          invitation: accepted.invitation,
        };
      },
      // Reopen, then leave: Better Auth accepts a pending invitation only, and
      // a retry must find something to accept. Every step that can fail leaves
      // a state a retry repairs: the invitation accepted with its membership
      // still there, which the replay above grants; never an accepted
      // invitation with no membership, which nothing could take back.
      async (entry) => {
        await this.invitations.reopen(entry.invitation.id);
        try {
          await this.organizations.leave(headers, entry.organizationId);
        } catch (error) {
          await this.invitations.markAccepted(entry.invitation.id);
          throw error;
        }
      },
    );
    return invitation.id;
  }

  /**
   * The invitation and the caller's membership as the roster has it now, when
   * the invitation is already accepted and the caller is who accepted it.
   * Recipient email plus the membership it created prove the caller is
   * replaying their own acceptance, not claiming someone else's.
   */
  private async acceptedByCaller(
    invitationId: string,
    caller: InvitationCaller | null,
  ): Promise<{ invitationId: string; membership: RosterEntry } | null> {
    if (!caller) return null;
    const found = await this.invitations.findOneById(invitationId);
    if (found.isNone()) return null;

    const invitation = found.unwrap();
    if (invitation.status !== 'accepted') return null;
    if (invitation.email.toLowerCase() !== caller.email.toLowerCase()) return null;

    const membership = await this.members.findMembership(invitation.organizationId, caller.id);
    if (membership.isNone()) return null;
    const { userId, organizationId, role } = membership.unwrap();
    return { invitationId: invitation.id, membership: { userId, organizationId, role } };
  }
}

function rosterEntry(userId: string, invitation: Invitation) {
  return { userId, organizationId: invitation.organizationId, role: invitation.role ?? 'member' };
}
