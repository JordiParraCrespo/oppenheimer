import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DELEGATED_SESSION } from '../../auth.di-tokens';
import type { DelegatedSessionPort } from '../../infrastructure/delegated-session.port';
import { RotateDelegatedSessionsCommand } from './rotate-delegated-sessions.command';

/**
 * Rotates an account's delegated-session generation, so no credential keeps
 * presenting a token cached for a session row that is gone.
 *
 * `AdminService.ban`/`.unban` do this themselves; a ban made straight through
 * Better Auth's own endpoint reaches it through the plugin's after-hook, which
 * cannot inject the port and so raises this command instead. Idempotent: a
 * second rotation only moves the keys again.
 */
@CommandHandler(RotateDelegatedSessionsCommand)
export class RotateDelegatedSessionsCommandHandler
  implements ICommandHandler<RotateDelegatedSessionsCommand, void>
{
  constructor(
    @Inject(DELEGATED_SESSION)
    private readonly delegatedSessions: DelegatedSessionPort,
  ) {}

  async execute(command: RotateDelegatedSessionsCommand): Promise<void> {
    await this.delegatedSessions.invalidateForUser(command.userId);
  }
}
