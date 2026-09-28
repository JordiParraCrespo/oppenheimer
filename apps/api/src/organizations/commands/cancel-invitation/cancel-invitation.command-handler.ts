import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { InvitationResponseDto } from '../../dtos/organization.response.dto';
import type { InvitationAuthPort } from '../../infrastructure/invitation-auth.port';
import { INVITATION_AUTH } from '../../organizations.di-tokens';
import { CancelInvitationCommand } from './cancel-invitation.command';

/** Withdraws an invitation before it is answered. */
@CommandHandler(CancelInvitationCommand)
export class CancelInvitationCommandHandler
  implements ICommandHandler<CancelInvitationCommand, InvitationResponseDto>
{
  constructor(
    @Inject(INVITATION_AUTH)
    private readonly invitations: InvitationAuthPort,
  ) {}

  execute(command: CancelInvitationCommand): Promise<InvitationResponseDto> {
    return this.invitations.cancel(command.headers, command.invitationId);
  }
}
