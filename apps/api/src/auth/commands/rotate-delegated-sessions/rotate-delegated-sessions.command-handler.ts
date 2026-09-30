import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DELEGATED_SESSION } from '../../auth.di-tokens';
import type { DelegatedSessionPort } from '../../infrastructure/delegated-session.port';
import { RotateDelegatedSessionsCommand } from './rotate-delegated-sessions.command';

/** Idempotent: a second rotation only moves the keys again. */
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
