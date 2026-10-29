import { Injectable } from '@nestjs/common';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { BotStallChecksPort, StallCheck } from './bot-stall-checks.port';

/** The job that checks a handed-off task got going; its payload is `{ subscriptionId, turn }`. */
export const CHECK_STALLED_SESSION_JOB = 'check-stalled-session';

/**
 * A stall check as a `bot-stall-checks` job on the outbox, held until its
 * time by the row's `availableAt`, so it survives a restart before it is due.
 */
@Injectable()
export class OutboxBotStallChecksAdapter implements BotStallChecksPort {
  constructor(private readonly outbox: OutboxService) {}

  async schedule(check: StallCheck, at: Date, correlationId: string | null): Promise<void> {
    await this.outbox.transaction((manager) =>
      this.outbox.stageJob(manager, {
        queue: QUEUE_NAMES.BOT_STALL_CHECKS,
        jobName: CHECK_STALLED_SESSION_JOB,
        payload: { subscriptionId: check.subscriptionId, turn: check.turn },
        reason: `bot ${check.botId} handed session ${check.sessionId} task #${check.turn}: check it got going`,
        aggregateId: check.subscriptionId,
        correlationId,
        availableAt: at,
      }),
    );
  }
}
