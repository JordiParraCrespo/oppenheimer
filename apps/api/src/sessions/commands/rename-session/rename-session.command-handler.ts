import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { SessionErrors } from '../../domain/sessions.errors';
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
  implements ICommandHandler<RenameSessionCommand, WorkSessionEntity>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async execute(command: RenameSessionCommand): Promise<WorkSessionEntity> {
    const found = await this.sessions.findOneById(command.scope, command.sessionId);
    if (found.isNone()) {
      throw new AppError(SessionErrors.NOT_FOUND, {
        detail: `No session with id ${command.sessionId}`,
      });
    }
    const session = found.unwrap();
    if (session.isResolved) {
      throw new AppError(SessionErrors.ALREADY_RESOLVED, {
        detail: `Session ${session.slug} is closed`,
      });
    }

    await this.sessions.appendEvents(session, [
      {
        idempotencyKey: WorkSessionEntity.apiIdempotencyKey(command.id, SESSION_EVENT_KINDS.NAMED),
        source: 'api',
        kind: SESSION_EVENT_KINDS.NAMED,
        payload: { name: command.name, source: 'user' },
      },
    ]);
    return session;
  }
}
