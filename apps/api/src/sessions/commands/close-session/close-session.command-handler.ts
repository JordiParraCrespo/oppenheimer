import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { CloseSessionCommand } from './close-session.command';

/**
 * Closes a session: push each checkout's branch, then remove the worktrees and
 * prune. **Nothing is deleted here.**
 *
 * The row stays for ever, `state` folds to `resolved`, and `uq (projectId, slug)`
 * becomes a permanent tombstone — which is the whole reason closing is a state and
 * not a `DELETE`. Claude Code and Codex key their conversation state by working
 * directory, so a new session landing on a retired session's directory name would
 * inherit a stranger's history: a bug that is near-impossible to diagnose from the
 * symptom, and free to rule out by never reissuing the name.
 *
 * The host's refusal is the host's. Closing refuses when a checkout has unpushed
 * work unless the caller accepts the loss, never passes `--force`, and relays git's
 * own words rather than paraphrasing them — so that refusal belongs to the
 * dispatcher and the runner, not to this handler.
 *
 * Closing twice is closing once: the aggregate is already resolved, and a retried
 * request after a lost response is not a conflict.
 */
@CommandHandler(CloseSessionCommand)
export class CloseSessionCommandHandler
  implements ICommandHandler<CloseSessionCommand, WorkSessionEntity>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: CloseSessionCommand): Promise<WorkSessionEntity> {
    const found = await this.sessions.findOneById(command.scope, command.sessionId);
    if (found.isNone()) {
      throw new AppError(SessionErrors.NOT_FOUND, {
        detail: `No session with id ${command.sessionId}`,
      });
    }
    const session = found.unwrap();
    if (session.isResolved) return session;

    await this.dispatch.close(session, { acceptUnpushedWork: command.acceptUnpushedWork });
    await this.sessions.appendEvents(session, [
      {
        idempotencyKey: WorkSessionEntity.apiIdempotencyKey(command.id, SESSION_EVENT_KINDS.CLOSED),
        source: 'api',
        kind: SESSION_EVENT_KINDS.CLOSED,
        payload: { acceptUnpushedWork: command.acceptUnpushedWork },
      },
    ]);
    return session;
  }
}
