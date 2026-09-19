import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  SessionCloseSpec,
  SessionDispatchOutcome,
  SessionDispatchPort,
  SessionLaunchSpec,
} from '../application/session-dispatch.port';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import type { SessionCheckoutEntity } from '../domain/session-checkout.entity';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import { WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';

/**
 * The dispatcher until there is a link to dispatch over.
 *
 * It does the one thing that keeps the slice honest: it records
 * `session.dispatch_pending` on the session's log, so "this work is owed to a host
 * that nothing can reach yet" is a durable fact with a timestamp rather than a
 * silence. The log is the source of truth, so when the relay lands, the record of
 * what was never delivered is already there.
 *
 * `delivered: false` and the `host_offline` hint are honest answers rather than
 * placeholders: with no relay, every host genuinely is offline, and the console
 * reading that hint will read the same hint for a real offline host later.
 */
@Injectable()
export class PendingSessionDispatchAdapter implements SessionDispatchPort {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  create(session: WorkSessionEntity, spec: SessionLaunchSpec): Promise<SessionDispatchOutcome> {
    return this.record(session, 'session.create', { branch: spec.branch });
  }

  stop(session: WorkSessionEntity): Promise<SessionDispatchOutcome> {
    return this.record(session, 'session.stop', {});
  }

  restart(session: WorkSessionEntity, spec: SessionLaunchSpec): Promise<SessionDispatchOutcome> {
    return this.record(session, 'session.restart', { branch: spec.branch });
  }

  close(session: WorkSessionEntity, spec: SessionCloseSpec): Promise<SessionDispatchOutcome> {
    return this.record(session, 'session.close', {
      acceptUnpushedWork: spec.acceptUnpushedWork,
    });
  }

  addCheckout(
    session: WorkSessionEntity,
    checkout: SessionCheckoutEntity,
    spec: SessionLaunchSpec,
  ): Promise<SessionDispatchOutcome> {
    return this.record(session, 'session.checkout.add', {
      checkoutId: checkout.id,
      directoryName: checkout.directoryName,
      branch: spec.branch,
    });
  }

  removeCheckout(
    session: WorkSessionEntity,
    checkout: SessionCheckoutEntity,
  ): Promise<SessionDispatchOutcome> {
    return this.record(session, 'session.checkout.remove', { checkoutId: checkout.id });
  }

  /**
   * One log entry per undelivered command, keyed by a fresh id: a second stop of
   * the same session is a second thing that was owed and never sent, not a replay
   * of the first.
   */
  private async record(
    session: WorkSessionEntity,
    command: string,
    detail: Record<string, unknown>,
  ): Promise<SessionDispatchOutcome> {
    await this.sessions.appendEvents(session, [
      {
        idempotencyKey: `dispatch:${randomUUID()}`,
        source: 'api',
        kind: SESSION_EVENT_KINDS.DISPATCH_PENDING,
        payload: { command, reason: 'no runner link exists yet', ...detail },
      },
    ]);
    return { delivered: false, hints: ['host_offline'] };
  }
}
