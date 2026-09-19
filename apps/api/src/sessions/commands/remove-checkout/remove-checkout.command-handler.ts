import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
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
 * If the agent was launched inside this checkout, the session steps out of it here
 * rather than relying on the foreign key's `ON DELETE SET NULL` — that clause never
 * fires, because nothing is deleted. The session degrades to its own directory
 * instead of pointing at a checkout that is no longer on disk.
 */
@CommandHandler(RemoveCheckoutCommand)
export class RemoveCheckoutCommandHandler
  implements ICommandHandler<RemoveCheckoutCommand, WorkSessionEntity>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: RemoveCheckoutCommand): Promise<WorkSessionEntity> {
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

    await this.dispatch.removeCheckout(session, target);
    const checkout = session.retireCheckout(command.checkoutId, new Date());
    if (!checkout) {
      throw new AppError(SessionErrors.CHECKOUT_NOT_FOUND, {
        detail: `No checkout with id ${command.checkoutId} on session ${session.slug}`,
      });
    }

    await this.sessions.retireCheckout(session, checkout, [
      {
        idempotencyKey: WorkSessionEntity.apiIdempotencyKey(
          command.id,
          SESSION_EVENT_KINDS.CHECKOUT_REMOVED,
        ),
        source: 'api',
        kind: SESSION_EVENT_KINDS.CHECKOUT_REMOVED,
        payload: { checkoutId: checkout.id, directoryName: checkout.directoryName },
      },
    ]);
    return session;
  }
}
