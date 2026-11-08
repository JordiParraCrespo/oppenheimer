import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type {
  SessionTerminalOutcome,
  SessionTerminalPort,
} from '../../application/session-terminal.port';
import { SESSION_TERMINAL } from '../../sessions.di-tokens';
import { DriveSessionTerminalCommand } from './drive-session-terminal.command';

/**
 * A bot driving a blank terminal (`product/versions/mvp/25-bots.md` §4.2,
 * "Driving a terminal"). The session is read first, in the caller's scope,
 * and that read is the authorization: one outside it is not found. Only a
 * blank terminal on a host is driven; whether the host lets a bot drive one
 * is the host's own policy, so its refusal comes back as an outcome the bot
 * reads, not an error.
 */
@CommandHandler(DriveSessionTerminalCommand)
export class DriveSessionTerminalCommandHandler
  implements ICommandHandler<DriveSessionTerminalCommand, SessionTerminalOutcome>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(SESSION_TERMINAL)
    private readonly terminals: SessionTerminalPort,
  ) {}

  async execute(command: DriveSessionTerminalCommand): Promise<SessionTerminalOutcome> {
    const session = await this.loader.find(command.scope, command.sessionId);
    if (session.agent !== 'shell' || session.hostId === null) {
      return {
        kind: 'failed',
        code: 'EXEC_007',
        detail: `session ${session.id} runs ${session.agent}, not a blank terminal`,
      };
    }
    return this.terminals.drive(session.hostId, session.id, command.request);
  }
}
