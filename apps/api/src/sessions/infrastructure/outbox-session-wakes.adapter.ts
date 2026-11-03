import { Injectable } from '@nestjs/common';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { SessionWake, SessionWakesPort } from '../application/session-wakes.port';

/** The job that types a wake into its session; its payload is the `SessionWake`. */
export const DELIVER_SESSION_WAKE_JOB = 'deliver-session-wake';

/**
 * A wake as a `session-wakes` job on the outbox, held until its time by the
 * row's `availableAt`, so it survives a restart before it is due.
 */
@Injectable()
export class OutboxSessionWakesAdapter implements SessionWakesPort {
  constructor(private readonly outbox: OutboxService) {}

  async schedule(wake: SessionWake, at: Date, correlationId: string | null): Promise<void> {
    await this.outbox.transaction((manager) =>
      this.outbox.stageJob(manager, {
        queue: QUEUE_NAMES.SESSION_WAKES,
        jobName: DELIVER_SESSION_WAKE_JOB,
        payload: { ...wake },
        reason: `wake ${wake.wakeId} (${wake.source}) for session ${wake.sessionId}, attempt ${wake.attempt}`,
        aggregateId: wake.sessionId,
        correlationId,
        availableAt: at,
      }),
    );
  }
}
