import { Injectable } from '@nestjs/common';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { BotTurnMapper } from '../bot-turn.mapper';
import type { BotCheckBacksPort, CheckBack } from './bot-check-backs.port';

/** The job that wakes a bot for a look it asked for; its payload is the look (`CheckBack`), dates as ISO strings. */
export const WAKE_ON_CHECK_BACK_JOB = 'wake-on-check-back';

/**
 * A look as a `bot-check-backs` job on the outbox, held until its time by
 * the row's `availableAt`, so it survives a restart before it is due.
 */
@Injectable()
export class OutboxBotCheckBacksAdapter implements BotCheckBacksPort {
  constructor(
    private readonly outbox: OutboxService,
    private readonly mapper: BotTurnMapper,
  ) {}

  async schedule(look: CheckBack, correlationId: string | null): Promise<void> {
    await this.outbox.transaction((manager) =>
      this.outbox.stageJob(manager, {
        queue: QUEUE_NAMES.BOT_CHECK_BACKS,
        jobName: WAKE_ON_CHECK_BACK_JOB,
        payload: this.mapper.toCheckBackPayload(look),
        reason: `bot ${look.botId} checks back on chain ${look.chainId}, look ${look.step}`,
        aggregateId: look.chainId,
        correlationId,
        availableAt: look.at,
      }),
    );
  }
}
