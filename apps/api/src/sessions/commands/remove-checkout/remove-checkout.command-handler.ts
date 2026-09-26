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
import { RemoveCheckoutCommand } from './remove-checkout.command';

/**
 * Retires one checkout: `git worktree remove` on the host, with the same
 * refuse-on-unpushed-work posture as closing a session, then `removedAt` here.
 *
 * The row is never deleted, which is what keeps `uq (sessionId, directoryName)` a
 * tombstone: the repository may be added again later, and it will take the next
 * directory name rather than the one it had.
 *
 * If the agent was launched inside this checkout, the session steps out of it — but
 * the fold is what does that, from `session.checkout_removed`, rather than a setter
 * beside the write. The foreign key's `ON DELETE SET NULL` never fires, because
 * nothing is deleted; the session degrades to its own directory, and a replay of
 * the log rebuilds that too.
 */
@CommandHandler(RemoveCheckoutCommand)
export class RemoveCheckoutCommandHandler
  implements ICommandHandler<RemoveCheckoutCommand, SessionCommandResult>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: RemoveCheckoutCommand): Promise<SessionCommandResult> {
    const found = await this.sessions.findOneById(command.scope, command.sessionId);
    if (found.isNone()) {
      throw new AppError(SessionErrors.NOT_FOUND, {
        detail: `No session with id ${command.sessionId}`,
      });
    }
    const session = found.unwrap();
    const target = session.liveCheckouts.find((checkout) => checkout.id === command.checkoutId);
    if (!target) {
      throw new AppError(SessionErrors.CHECKOUT_NOT_FOUND, {
        detail: `No checkout with id ${command.checkoutId} on session ${session.slug}`,
      });
    }

    // The event is what retires the checkout: folding it marks the child row and
    // steps the agent out of it, so the `removedAt` the repository writes and the
    // log that explains it cannot disagree.
    await this.sessions.retireCheckout(session, target, [
      {
        idempotencyKey: WorkSessionEntity.apiIdempotencyKey(
          command.id,
          SESSION_EVENT_KINDS.CHECKOUT_REMOVED,
        ),
        source: 'api',
        kind: SESSION_EVENT_KINDS.CHECKOUT_REMOVED,
        payload: { checkoutId: target.id, directoryName: target.directoryName },
      },
    ]);
    const { hints } = await this.dispatch.removeCheckout(session, target);
    return { sessionId: session.id, hints };
  }
}
