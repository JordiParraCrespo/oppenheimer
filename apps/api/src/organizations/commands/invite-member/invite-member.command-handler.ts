import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { InvitationAuthPort } from '../../infrastructure/invitation-auth.port';
import { INVITATION_AUTH } from '../../organizations.di-tokens';
import { InviteMemberCommand } from './invite-member.command';

/** Invites someone, by email, to join an organization in the role given. */
@CommandHandler(InviteMemberCommand)
export class InviteMemberCommandHandler
  implements ICommandHandler<InviteMemberCommand, AggregateID>
{
  constructor(
    @Inject(INVITATION_AUTH)
    private readonly invitations: InvitationAuthPort,
  ) {}

  async execute(command: InviteMemberCommand): Promise<AggregateID> {
    const invitation = await this.invitations.invite(
      command.headers,
      command.organizationId,
      command.input,
    );
    return invitation.id;
  }
}
