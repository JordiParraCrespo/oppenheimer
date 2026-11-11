import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { visibilityEntry } from '../../domain/session-log-entry.factory';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { SetSessionVisibilityCommand } from './set-session-visibility.command';

/**
 * Hides a session from the console's sidebar, or shows it again: an entry in
 * its log, folded into `hidden` like a rename into `name`, so every console
 * open on the workspace hears of it the way it hears of any other change.
 *
 * A closed session takes it too: hiding is about the list, not the work.
 * Asking for what the session already is writes nothing.
 */
@CommandHandler(SetSessionVisibilityCommand)
export class SetSessionVisibilityCommandHandler
  implements ICommandHandler<SetSessionVisibilityCommand, SessionCommandResult>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async execute(command: SetSessionVisibilityCommand): Promise<SessionCommandResult> {
    const session = await this.loader.find(command.scope, command.sessionId);
    if (session.hidden !== command.hidden) {
      await this.sessions.appendEvents(session, [visibilityEntry(command.id, command.hidden)]);
    }
    // Nothing on the host hears of it: the sidebar is the console's.
    return { sessionId: session.id, hints: [] };
  }
}
