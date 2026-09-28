import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { InvitationResponseDto } from '../../dtos/organization.response.dto';
import type { InvitationAuthPort } from '../../infrastructure/invitation-auth.port';
import { INVITATION_AUTH } from '../../organizations.di-tokens';
import { RejectInvitationCommand } from './reject-invitation.command';

/** Declines an invitation the caller was sent. */
@CommandHandler(RejectInvitationCommand)
export class RejectInvitationCommandHandler
  implements ICommandHandler<RejectInvitationCommand, InvitationResponseDto>
{
  constructor(
    @Inject(INVITATION_AUTH)
    private readonly invitations: InvitationAuthPort,
  ) {}

  execute(command: RejectInvitationCommand): Promise<InvitationResponseDto> {
    return this.invitations.reject(command.headers, command.invitationId);
  }
}
