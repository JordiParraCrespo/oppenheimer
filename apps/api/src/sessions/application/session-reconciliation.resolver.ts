import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SessionTerminalWatchRepositoryPort } from '../database/session-terminal-watch.repository.port';
import type {
  HostSessionRow,
  WorkSessionRepositoryPort,
} from '../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import { WorkSessionEntity } from '../domain/work-session.entity';
import {
  SESSION_DISPATCH,
  SESSION_TERMINAL_WATCH_REPOSITORY,
  WORK_SESSION_REPOSITORY,
} from '../sessions.di-tokens';
import type { SessionDispatchPort } from './session-dispatch.port';
import { SessionLaunchSpecFactory } from './session-launch.factory';
import type {
  HostReconciliationOutcome,
  SessionReconciliationPort,
} from './session-reconciliation.port';

/**
 * Reconciles a host's hello against the rows, in three cases. A `starting` session
 * the host does not hold is a launch that never arrived (created while it was offline,
 * or lost with the link) and is dispatched again; the runner is idempotent by session
 * id. An `open` session the host does not hold is one tmux lost (a reboot, a kill) and
 * is recorded stopped, so the console offers Restart, not a live dot for a gone pane.
 * A session with a **close still owed** (the fold's `closeRequest`) is sent the close
 * again, with the `acceptUnpushedWork` it was asked with, whether or not the host holds
 * it: a close lost with the link is otherwise never sent, and the runner answers
 * `session.closed` even for a session it no longer knows. An owed close replaces an
 * owed launch: a session is never built only to be closed. A `failed` session is read
 * for that alone: a person may delete one, and nothing else here concerns it.
 * A started cloud session is never held by its host, so it is never recorded stopped.
 * What the host holds that the rows do not know is logged and left alone: ending
 * someone's work is not a side effect of a hello.
 *
 * The stopped entry is keyed by the runner's `runId`, so a replayed hello writes it once.
 * A close sent twice is harmless for the same reason the runner makes it so.
 * The terminal watches of the live sessions it holds are sent again too: a
 * runner keeps them in memory only.
 */
@Injectable()
export class SessionReconciliationResolver implements SessionReconciliationPort {
  private readonly logger = new Logger(SessionReconciliationResolver.name);

  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
    private readonly launches: SessionLaunchSpecFactory,
    @Inject(SESSION_TERMINAL_WATCH_REPOSITORY)
    private readonly watches: SessionTerminalWatchRepositoryPort,
  ) {}

  async reconcile(
    hostId: string,
    runId: string,
    heldSessionIds: readonly string[],
  ): Promise<HostReconciliationOutcome> {
    const held = new Set(heldSessionIds);
    const rows = await this.sessions.findUnresolvedForHostForMachine(hostId);
    const outcome: HostReconciliationOutcome = { redispatched: [], stopped: [], reclosed: [] };

    for (const row of rows) {
      const { session } = row;
      if (!held.has(session.id)) {
        if (session.state === 'starting') {
          if (!session.closeRequest && (await this.launchAgain(row))) {
            outcome.redispatched.push(session.id);
          }
        } else if (
          session.state === 'open' &&
          // A cloud session lives on claude.ai/code: the host never holds it,
          // and its absence from a hello is not a lost pane.
          session.place !== 'cloud' &&
          session.stoppedAt === null &&
          (await this.recordStopped(session, runId))
        ) {
          outcome.stopped.push(session.id);
        }
      }
      const close = session.closeRequest;
      if (close) {
        const { delivered } = await this.dispatch.close(session, {
          acceptUnpushedWork: close.acceptUnpushedWork,
        });
        if (delivered) outcome.reclosed.push(session.id);
      }
    }

    await this.watchAgain(rows.map((row) => row.session).filter((session) => held.has(session.id)));

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

  /**
   * The first task's images ride again with it: the log recorded the ids they were
   * parked under, and the runner pulls what is still waiting.
   */
  private async launchAgain({ session, prompt, images }: HostSessionRow): Promise<boolean> {
    const { delivered } = await this.dispatch.create(
      session,
      await this.launches.build(session, { prompt, images }),
    );
    return delivered;
  }

  /**
   * A runner keeps terminal watches in memory, so every hello is sent the
   * watches of the live sessions it holds again, each with the newest count
   * it reported: a runner that still holds one keeps it, and one that
   * restarted counts on from there, so its next report is past what the bot
   * was told. Best effort: a watch that does not reach the runner now is
   * sent with its next hello.
   */
  private async watchAgain(held: readonly WorkSessionEntity[]): Promise<void> {
    const live = held.filter((session) => session.state === 'open' && session.stoppedAt === null);
    const byOrganization = new Map<string, WorkSessionEntity[]>();
    for (const session of live) {
      byOrganization.set(session.organizationId, [
        ...(byOrganization.get(session.organizationId) ?? []),
        session,
      ]);
    }
    for (const [organizationId, sessions] of byOrganization) {
      const watches = await this.watches.findForSessions(
        organizationId,
        sessions.map((session) => session.id),
      );
      for (const watch of watches) {
        const session = sessions.find((candidate) => candidate.id === watch.sessionId);
        if (session) {
          await this.dispatch.watchTerminal(session, {
            watchId: watch.id,
            pattern: watch.pattern,
            count: watch.matches,
          });
        }
      }
    }
  }

  private async recordStopped(session: WorkSessionEntity, runId: string): Promise<boolean> {
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
    return appended.accepted.length > 0;
  }
}
