import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { CloseSessionCommand } from './close-session.command';

/**
 * Asks to close a session: push each checkout's branch, then remove the worktrees
 * and prune. **It records a request, not an outcome.**
 *
 * That is why it is shaped like restart, not stop. The host can legitimately refuse:
 * a checkout with unpushed work is not removed unless the caller accepted the loss,
 * `--force` is never passed, and git's words are relayed verbatim. So `session.closed`
 * arrives from the host and the fold moves the row to `resolved` then; resolving here
 * would make the terminal tombstone permanent before anybody looked at the worktrees.
 *
 * `acceptUnpushedWork` rides with the close the runner is sent, and on the log entry:
 * it lets a host remove a dirty worktree. The fold keeps the request as the row's
 * `closeRequest` until the host answers, so with the host offline (or the link lost
 * after the send) the session stays `open` with a close owed, the honest state, which
 * the `host_offline` hint reports and the host's next hello is sent again
 * (`SessionReconciliationResolver`).
 *
 * Asking twice is asking once for a session already resolved: a retry after a lost
 * response is not a conflict.
 *
 * A cloud session left nothing on a host, so its close is recorded whole here:
 * the request and `session.closed` together, with no host to wait for, online or
 * not. Claude Code's stays on claude.ai/code, where it is archived; a vendor's
 * agent stays at its vendor, its page and branch the person's to keep or delete
 * (`product/next-steps/cloud-agents.md`).
 */
@CommandHandler(CloseSessionCommand)
export class CloseSessionCommandHandler
  implements ICommandHandler<CloseSessionCommand, SessionCommandResult>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: CloseSessionCommand): Promise<SessionCommandResult> {
    const session = await this.loader.find(command.scope, command.sessionId);
    if (session.isResolved) return { sessionId: session.id, hints: [] };

    const requested = this.entry(command, SESSION_EVENT_KINDS.CLOSE_REQUESTED, {
      acceptUnpushedWork: command.acceptUnpushedWork,
    });
    if (session.closesWithoutItsHost) {
      await this.sessions.appendEvents(session, [
        requested,
        this.entry(command, SESSION_EVENT_KINDS.CLOSED, { by: 'api' }),
      ]);
      return { sessionId: session.id, hints: [] };
    }

    await this.sessions.appendEvents(session, [requested]);
    const { hints } = await this.dispatch.close(session, {
      acceptUnpushedWork: command.acceptUnpushedWork,
    });
    return { sessionId: session.id, hints };
  }

  private entry(command: CloseSessionCommand, kind: string, payload: unknown) {
    return {
      idempotencyKey: WorkSessionEntity.apiIdempotencyKey(command.id, kind),
      source: 'api' as const,
      kind,
      payload,
    };
  }
}
