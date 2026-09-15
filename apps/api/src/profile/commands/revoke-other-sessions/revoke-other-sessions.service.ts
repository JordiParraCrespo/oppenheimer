import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ProfileAuthFacade } from '../../services/profile-auth.facade';
import { RevokeOtherSessionsCommand } from './revoke-other-sessions.command';

/**
 * Signs every other device out. Which session is "this one" is resolved by
 * Better Auth from the request headers, so the caller never names it — and
 * cannot accidentally sign itself out by naming the wrong id.
 */
@CommandHandler(RevokeOtherSessionsCommand)
export class RevokeOtherSessionsService
  implements ICommandHandler<RevokeOtherSessionsCommand, void>
{
  constructor(private readonly profileAuth: ProfileAuthFacade) {}

  async execute(command: RevokeOtherSessionsCommand): Promise<void> {
    await this.profileAuth.revokeOtherSessions(command.headers, command.userId);
  }
}
