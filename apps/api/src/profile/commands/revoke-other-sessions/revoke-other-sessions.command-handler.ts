import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { ProfileAuthPort } from '../../infrastructure/profile-auth.port';
import { PROFILE_AUTH } from '../../profile.di-tokens';
import { RevokeOtherSessionsCommand } from './revoke-other-sessions.command';

/**
 * Signs every other device out. Which session is "this one" is resolved by
 * Better Auth from the request headers, so the caller never names it — and
 * cannot accidentally sign itself out by naming the wrong id.
 */
@CommandHandler(RevokeOtherSessionsCommand)
export class RevokeOtherSessionsCommandHandler
  implements ICommandHandler<RevokeOtherSessionsCommand, void>
{
  constructor(
    @Inject(PROFILE_AUTH)
    private readonly profileAuth: ProfileAuthPort,
  ) {}

  async execute(command: RevokeOtherSessionsCommand): Promise<void> {
    await this.profileAuth.revokeOtherSessions(command.headers, command.userId);
  }
}
