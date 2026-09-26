import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { CloseSessionCommand } from './close-session.command';

/**
 * Asks to close a session: push each checkout's branch, then remove the worktrees
 * and prune. **It records a request, not an outcome.**
 *
 * That is the difference from stopping, and it is the whole reason this handler is
 * shaped like restart rather than like stop. Closing has to do work on the host
 * that can legitimately refuse — a checkout with unpushed work is not removed
 * unless the caller accepted the loss, `--force` is never passed, and git's own
 * words are relayed rather than paraphrased. Only the host can say that work
 * happened, so `session.closed` arrives from the host and the fold moves the row to
 * `resolved` then. A control plane that resolved the row here would make the
 * tombstone permanent before anybody had looked at the worktrees, and `resolved` is
 * terminal.
 *
 * `acceptUnpushedWork` rides in the payload because the runner is its reader: it is
 * what tells a host it may remove a dirty worktree.
 *
 * Until the relay exists, that means a close leaves the session `open` with a
 * request on its log. That is the honest state — nothing has been pushed or
 * removed — and it is what the `host_offline` hint on the response says.
 *
 * Asking twice is asking once for a session already resolved: a retried request
 * after a lost response is not a conflict.
 */
@CommandHandler(CloseSessionCommand)
export class CloseSessionCommandHandler
  implements ICommandHandler<CloseSessionCommand, SessionCommandResult>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: CloseSessionCommand): Promise<SessionCommandResult> {
    const found = await this.sessions.findOneById(command.scope, command.sessionId);
    if (found.isNone()) {
      throw new AppError(SessionErrors.NOT_FOUND, {
        detail: `No session with id ${command.sessionId}`,
      });
    }
    const session = found.unwrap();
    if (session.isResolved) return { sessionId: session.id, hints: [] };

    await this.sessions.appendEvents(session, [
      {
        idempotencyKey: WorkSessionEntity.apiIdempotencyKey(
          command.id,
          SESSION_EVENT_KINDS.CLOSE_REQUESTED,
        ),
        source: 'api',
        kind: SESSION_EVENT_KINDS.CLOSE_REQUESTED,
        payload: { acceptUnpushedWork: command.acceptUnpushedWork },
      },
    ]);
    const { hints } = await this.dispatch.close(session, {
      acceptUnpushedWork: command.acceptUnpushedWork,
    });
    return { sessionId: session.id, hints };
  }
}
