import { Inject, Injectable, Logger } from '@nestjs/common';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { sessionBranchName } from '../domain/session-layout.policy';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import { WorkSessionEntity } from '../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';
import type { SessionDispatchPort } from './session-dispatch.port';
import type {
  HostReconciliationOutcome,
  SessionReconciliationPort,
} from './session-reconciliation.port';

/**
 * Reconciles a host's hello against the rows.
 *
 * Two cases, and only two. A session still `starting` that the host does not
 * hold is a launch that never arrived — created while the host was offline, or
 * lost with the link — and is dispatched again; the runner is idempotent by
 * session id, so a launch it did carry out is a no-op. A session the rows call
 * `open` that the host does not hold is one tmux lost (a reboot, a kill), and
 * is recorded stopped so the console shows a Restart button rather than a live
 * dot for a pane that is gone. Anything the host holds that the rows do not
 * know is logged and left alone: ending someone's work is not a side effect of
 * a hello.
 *
 * The stopped entry is keyed by the runner's `runId`, so the same hello
 * replayed after a reconnect writes it once.
 */
@Injectable()
export class SessionReconciliationResolver implements SessionReconciliationPort {
  private readonly logger = new Logger(SessionReconciliationResolver.name);

  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async reconcile(
    hostId: string,
    runId: string,
    heldSessionIds: readonly string[],
  ): Promise<HostReconciliationOutcome> {
    const held = new Set(heldSessionIds);
    const rows = await this.sessions.findUnresolvedForHostForMachine(hostId);
    const outcome: HostReconciliationOutcome = { redispatched: [], stopped: [] };

    for (const { session, projectSlug, prompt } of rows) {
      if (held.has(session.id)) continue;
      if (session.state === 'starting') {
        const { delivered } = await this.dispatch.create(session, {
          projectSlug,
          branch: sessionBranchName(projectSlug, session.slug),
          ...(prompt ? { prompt } : {}),
        });
        if (delivered) outcome.redispatched.push(session.id);
        continue;
      }
      if (session.stoppedAt !== null) continue;
      const appended = await this.sessions.appendEvents(session, [
        {
          idempotencyKey: WorkSessionEntity.apiIdempotencyKey(
            `hello-${runId}`,
            SESSION_EVENT_KINDS.STOPPED,
          ),
          source: 'api',
          kind: SESSION_EVENT_KINDS.STOPPED,
          payload: { source: 'reconciliation', runId },
        },
      ]);
      if (appended.accepted.length > 0) outcome.stopped.push(session.id);
    }

    const known = new Set(rows.map((row) => row.session.id));
    const unknown = heldSessionIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      this.logger.warn({
        message: 'host holds sessions the rows do not',
        hostId,
        sessions: unknown,
      });
    }
    return outcome;
  }
}
