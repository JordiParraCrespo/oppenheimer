import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { RemoveCheckoutCommand } from './remove-checkout.command';

/**
 * Retires one checkout: `git worktree remove` on the host, refusing on unpushed work
 * as closing a session does, then `removedAt` here.
 *
 * The row is never deleted, so `uq (sessionId, directoryName)` stays a tombstone: a
 * repository added again takes the next directory name, not its old one. If the agent
 * was launched inside this checkout, folding `session.checkout_removed` steps the
 * session out of it.
 */
@CommandHandler(RemoveCheckoutCommand)
export class RemoveCheckoutCommandHandler
  implements ICommandHandler<RemoveCheckoutCommand, SessionCommandResult>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: RemoveCheckoutCommand): Promise<SessionCommandResult> {
    const session = await this.loader.find(command.scope, command.sessionId);
    const target = session.liveCheckouts.find((checkout) => checkout.id === command.checkoutId);
    if (!target) {
      throw new AppError(SessionErrors.CHECKOUT_NOT_FOUND, {
        detail: `No checkout with id ${command.checkoutId} on session ${session.slug}`,
      });
    }

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
