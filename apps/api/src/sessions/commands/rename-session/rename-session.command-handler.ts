import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { RenameSessionCommand } from './rename-session.command';

/**
 * Renames a session — which is an **entry in its log**, not a column write.
 *
 * The name is part of the fold, so a rename is recorded the same way a start or a
 * stop is, and the row is the result of replaying them. That is also what makes
 * "the namer never overwrites a name a person typed" a rule the fold enforces
 * rather than a check somebody has to remember: the entry carries who named it.
 */
@CommandHandler(RenameSessionCommand)
export class RenameSessionCommandHandler
  implements ICommandHandler<RenameSessionCommand, SessionCommandResult>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async execute(command: RenameSessionCommand): Promise<SessionCommandResult> {
    const session = await this.loader.requireLive(command.scope, command.sessionId);

    await this.sessions.appendEvents(session, [
      {
        idempotencyKey: WorkSessionEntity.apiIdempotencyKey(command.id, SESSION_EVENT_KINDS.NAMED),
        source: 'api',
        kind: SESSION_EVENT_KINDS.NAMED,
        payload: { name: command.name, source: 'user' },
      },
    ]);
    // Renaming tells no host anything: the name is display only, and the slug the
    // runner keys every path on does not change.
    return { sessionId: session.id, hints: [] };
  }
}
