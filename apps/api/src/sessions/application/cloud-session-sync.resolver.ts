import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { CloudRunsPort } from '../../cloud-agents/application/cloud-runs.port';
import { CLOUD_RUNS } from '../../cloud-agents/cloud-agents.di-tokens';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { DETAIL_SYNC_AFTER_MS, needsSync, runsToSync } from '../domain/cloud-session-sync.policy';
import { cloudRunEntries } from '../domain/session-log-entry.factory';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import { WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';

/**
 * Asks a cloud session's vendor where its run stands, on the launcher's key,
 * and writes the answer: the run row, and the entries it owes the session's
 * log, which the fold turns into the state the sidebar shows
 * (`cloudRunLogEntries`). When is `cloud-session-sync.policy.ts`'s.
 *
 * A read never fails because the vendor did: a rate limit, an outage or a key
 * gone since leaves the session as it was last heard of, and its run's
 * `syncedAt` says how long ago that was.
 *
 * Two reads that race write once: the log's entries are keyed by run and
 * fact, and the run row is written only while it is still on the run it was
 * read with (`saveCloudRunIf`).
 */
@Injectable()
export class CloudSessionSyncResolver {
  private readonly logger = new Logger(CloudSessionSyncResolver.name);

  constructor(
    @Inject(CLOUD_RUNS) private readonly runs: CloudRunsPort,
    @Inject(WORK_SESSION_REPOSITORY) private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  /** A list's page: its stalest few working cloud sessions. */
  async syncPage(page: readonly WorkSessionEntity[], now: Date): Promise<void> {
    const due = new Set(
      runsToSync(
        page.flatMap((session) => session.cloudRun ?? []),
        now,
      ),
    );
    await Promise.all(
      page
        .filter((session) => session.cloudRun && due.has(session.cloudRun))
        .map((session) => this.sync(session, now)),
    );
  }

  /** One session read on its own, at most once in {@link DETAIL_SYNC_AFTER_MS}. */
  async syncOne(session: WorkSessionEntity, now: Date): Promise<void> {
    if (session.cloudRun && needsSync(session.cloudRun, now, DETAIL_SYNC_AFTER_MS)) {
      await this.sync(session, now);
    }
  }

  private async sync(session: WorkSessionEntity, now: Date): Promise<void> {
    const run = session.cloudRun;
    if (!run) return;
    try {
      const report = await this.runs.read(
        { organizationId: session.organizationId, userId: session.createdByUserId },
        run.provider,
        run.externalId,
        run.latestRunId,
      );
      const runIdAtLoad = run.latestRunId;
      run.synced(report, now);
      await this.sessions.saveCloudRunIf(run, runIdAtLoad);
      const events = cloudRunEntries(report, now);
      if (events.length > 0) await this.sessions.appendEvents(session, events);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      this.logger.warn({
        message: 'A cloud session could not be synced; showing what was last heard',
        sessionId: session.id,
        provider: run.provider,
        code: error.code,
        detail: error.detail,
      });
    }
  }
}
