import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Job, Queue } from 'bullmq';
import { ProcessInboundDeliveryCommand } from '../commands/process-inbound-delivery/process-inbound-delivery.command';
import { PROCESS_DELIVERY_JOB } from '../database/inbound-event.repository';
import type { InboundEventRepositoryPort } from '../database/inbound-event.repository.port';
import { DELIVERY_RETENTION_DAYS } from '../domain/delivery-retention.policy';
import { INBOUND_EVENT_REPOSITORY } from '../inbound-events.di-tokens';

/** Normalized events: the trigger preview's week, with room to debug a recent run. */
export const EVENT_RETENTION_DAYS = 30;
const RETENTION_BATCH = 5_000;
const MAX_BATCHES = 200;
const PURGE_JOB = 'purge';
const SWEEP_JOB = 'sweep';
const SCHEDULER_ID = 'inbound-events-retention-daily';
const SWEEP_SCHEDULER_ID = 'inbound-events-sweep';
const MINUTE = 60_000;
/** A delivery unprocessed this long has outlived its job's retries. */
const STALE_AFTER_MS = 15 * MINUTE;
/** Past this it is not going to process; it is marked failed for a replay. */
const ABANDON_AFTER_MS = 24 * 60 * MINUTE;
const SWEEP_BATCH = 500;

/**
 * The hub's worker: processes stored deliveries (staged on the outbox by the
 * receive path, so a job is never lost between a commit and Redis), sweeps
 * every five minutes for deliveries whose job ran out of retries, and once a
 * day purges what retention says is not kept. One queue for both, because
 * both are the hub's own work on its own tables.
 */
@Processor(QUEUE_NAMES.INBOUND_EVENTS)
export class InboundEventsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(InboundEventsProcessor.name);

  constructor(
    private readonly commandBus: CommandBus,
    @Inject(INBOUND_EVENT_REPOSITORY)
    private readonly store: InboundEventRepositoryPort,
    @InjectQueue(QUEUE_NAMES.INBOUND_EVENTS)
    private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // 04:23 UTC, off the hour and away from the hosts purge at 03:17.
    await this.queue.upsertJobScheduler(
      SCHEDULER_ID,
      { pattern: '23 4 * * *', tz: 'UTC' },
      { name: PURGE_JOB },
    );
    await this.queue.upsertJobScheduler(
      SWEEP_SCHEDULER_ID,
      { every: 5 * MINUTE },
      { name: SWEEP_JOB },
    );
  }

  async process(job: Job<{ inboundDeliveryId?: string }>): Promise<unknown> {
    if (job.name === PROCESS_DELIVERY_JOB && job.data.inboundDeliveryId) {
      return this.commandBus.execute(
        new ProcessInboundDeliveryCommand({ inboundDeliveryId: job.data.inboundDeliveryId }),
      );
    }
    if (job.name === PURGE_JOB) return this.purge();
    if (job.name === SWEEP_JOB) {
      const now = Date.now();
      return this.store.restageUnprocessed(
        new Date(now - STALE_AFTER_MS),
        new Date(now - ABANDON_AFTER_MS),
        SWEEP_BATCH,
      );
    }
    this.logger.warn({ message: 'Unknown inbound-events job', name: job.name });
    return null;
  }

  private async purge(): Promise<{ deliveries: number; events: number }> {
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const deliveries = await drain((batch) =>
      this.store.deleteDeliveriesBefore(new Date(now - DELIVERY_RETENTION_DAYS * day), batch),
    );
    const events = await drain((batch) =>
      this.store.deleteEventsBefore(new Date(now - EVENT_RETENTION_DAYS * day), batch),
    );
    this.logger.log({ message: 'inbound-events retention ran', deliveries, events });
    return { deliveries, events };
  }
}

async function drain(deleteBatch: (batch: number) => Promise<number>): Promise<number> {
  let total = 0;
  for (let i = 0; i < MAX_BATCHES; i += 1) {
    const deleted = await deleteBatch(RETENTION_BATCH);
    total += deleted;
    if (deleted < RETENTION_BATCH) break;
  }
  return total;
}
