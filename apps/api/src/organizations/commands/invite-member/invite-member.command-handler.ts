import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { InvitationResponseDto } from '../../dtos/organization.response.dto';
import type { InvitationAuthPort } from '../../infrastructure/invitation-auth.port';
import { INVITATION_AUTH } from '../../organizations.di-tokens';
import { InviteMemberCommand } from './invite-member.command';

/** Invites someone, by email, to join an organization in the role given. */
@CommandHandler(InviteMemberCommand)
export class InviteMemberCommandHandler
  implements ICommandHandler<InviteMemberCommand, InvitationResponseDto>
{
  constructor(
    @Inject(INVITATION_AUTH)
    private readonly invitations: InvitationAuthPort,
  ) {}

  execute(command: InviteMemberCommand): Promise<InvitationResponseDto> {
    return this.invitations.invite(command.headers, command.organizationId, command.input);
  }
}
