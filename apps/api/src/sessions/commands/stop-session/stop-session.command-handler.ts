import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { StopSessionCommand } from './stop-session.command';

/**
 * Stops a session: the agent and the tmux session end, and **every checkout stays on
 * disk**, so a restart recreates window 0 in the same worktrees.
 *
 * The stored lifecycle does not move: it answers whether the work is finished, and a
 * stopped session is as unfinished as it was. `stoppedAt` is all that changes.
 *
 * **One append.** Stopping is a control-plane decision, not a reported outcome: the
 * session will not be dispatched again, listening or not. The host is told after the
 * entry, and what could not be delivered is a hint on the response rather than a
 * second entry in a second transaction.
 */
@CommandHandler(StopSessionCommand)
export class StopSessionCommandHandler
  implements ICommandHandler<StopSessionCommand, SessionCommandResult>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: StopSessionCommand): Promise<SessionCommandResult> {
    const session = await this.loader.requireLive(command.scope, command.sessionId);

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
    const { hints } = await this.dispatch.stop(session);
    return { sessionId: session.id, hints };
  }
}
