import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { InvitationAuthPort } from '../../infrastructure/invitation-auth.port';
import { INVITATION_AUTH } from '../../organizations.di-tokens';
import { CancelInvitationCommand } from './cancel-invitation.command';

@CommandHandler(CancelInvitationCommand)
export class CancelInvitationCommandHandler
  implements ICommandHandler<CancelInvitationCommand, AggregateID>
{
  constructor(
    @Inject(INVITATION_AUTH)
    private readonly invitations: InvitationAuthPort,
  ) {}

  async execute(command: CancelInvitationCommand): Promise<AggregateID> {
    await this.invitations.cancel(command.headers, command.invitationId);
    return command.invitationId;
  }
}
