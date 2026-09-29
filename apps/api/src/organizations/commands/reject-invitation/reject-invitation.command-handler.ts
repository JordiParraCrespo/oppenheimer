import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { InvitationAuthPort } from '../../infrastructure/invitation-auth.port';
import { INVITATION_AUTH } from '../../organizations.di-tokens';
import { RejectInvitationCommand } from './reject-invitation.command';

/** Declines an invitation the caller was sent. */
@CommandHandler(RejectInvitationCommand)
export class RejectInvitationCommandHandler
  implements ICommandHandler<RejectInvitationCommand, AggregateID>
{
  constructor(
    @Inject(INVITATION_AUTH)
    private readonly invitations: InvitationAuthPort,
  ) {}

  async execute(command: RejectInvitationCommand): Promise<AggregateID> {
    await this.invitations.reject(command.headers, command.invitationId);
    return command.invitationId;
  }
}
