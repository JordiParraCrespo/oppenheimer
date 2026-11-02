import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import type { SessionTerminalWatchRepositoryPort } from '../../database/session-terminal-watch.repository.port';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import {
  SESSION_DISPATCH,
  SESSION_TERMINAL_WATCH_REPOSITORY,
  WORK_SESSION_REPOSITORY,
} from '../../sessions.di-tokens';
import { UnwatchSessionTerminalCommand } from './unwatch-session-terminal.command';

/**
 * Removes a terminal watch and tells the host, when it is reachable, to stop
 * scanning for it. One already gone is no error, and nor is a host that is
 * not there: a runner holds watches in memory only, and is sent the rows on
 * its next hello, so a watch removed while it was away is never sent again.
 */
@CommandHandler(UnwatchSessionTerminalCommand)
export class UnwatchSessionTerminalCommandHandler
  implements ICommandHandler<UnwatchSessionTerminalCommand, boolean>
{
  constructor(
    @Inject(SESSION_TERMINAL_WATCH_REPOSITORY)
    private readonly watches: SessionTerminalWatchRepositoryPort,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute({
    organizationId,
    sessionId,
    watchId,
  }: UnwatchSessionTerminalCommand): Promise<boolean> {
    const removed = await this.watches.delete(organizationId, sessionId, watchId);
    if (!removed) return false;
    const found = await this.sessions.findOneByIdForMachine(sessionId);
    if (found.isSome() && found.unwrap().organizationId === organizationId) {
      await this.dispatch.unwatchTerminal(found.unwrap(), watchId);
    }
    return true;
  }
}
