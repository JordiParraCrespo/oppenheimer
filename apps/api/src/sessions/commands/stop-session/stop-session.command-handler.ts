import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { StopSessionCommand } from './stop-session.command';

/**
 * Stops a session: the agent and the tmux session end, and **every checkout stays
 * on disk**, so a restart recreates window 0 in the same worktrees.
 *
 * Stopping is not closing, and the stored lifecycle does not move: it answers
 * whether the work is finished, and a stopped session is exactly as unfinished as
 * it was. `stoppedAt` is the whole of what changes.
 *
 * The host is told first and the log records it either way. With no link to the
 * host — which is every host until the relay exists — the dispatcher records that
 * the command is owed, and the session is stopped as far as the control plane is
 * concerned.
 */
@CommandHandler(StopSessionCommand)
export class StopSessionCommandHandler
  implements ICommandHandler<StopSessionCommand, WorkSessionEntity>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: StopSessionCommand): Promise<WorkSessionEntity> {
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

    await this.dispatch.stop(session);
    await this.sessions.appendEvents(session, [
      {
        idempotencyKey: WorkSessionEntity.apiIdempotencyKey(
          command.id,
          SESSION_EVENT_KINDS.STOPPED,
        ),
        source: 'api',
        kind: SESSION_EVENT_KINDS.STOPPED,
        payload: { requestedBy: 'api' },
      },
    ]);
    return session;
  }
}
