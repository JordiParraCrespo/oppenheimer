import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

const positive = (fallback: number) => z.coerce.number().int().positive().default(fallback);

/**
 * How long the nightly purges keep what they purge, and how they purge it.
 * Each purge is a BullMQ job scheduler that runs once a day however many
 * replicas there are; the schedules themselves stay beside each processor,
 * staggered so no two run at once.
 *
 * **Defaulted, all of it**: a deployment that sets nothing keeps what
 * `product/versions/mvp/15-host-metadata.md` and the automations and outbox
 * notes decided. A value only ever changes how long rows live, so nothing
 * here can fail a boot on its absence.
 */
const schema = z.object({
  /** An IP address is personal data: where a laptop has been is kept this long past its last use. */
  hostNetworkDays: positive(90),
  /** The host timeline is kept long enough to answer "what changed this season". */
  hostTimelineDays: positive(180),
  /** Finished automation runs, and their history. */
  automationRunDays: positive(180),
  /** Processed inbound events (GitHub webhooks). */
  inboundEventDays: positive(30),
  /** Delivered outbox rows: enough to answer "did this event go out?" about last week. */
  outboxDays: positive(7),
  /** Rows per delete statement, so a large purge never holds a long lock. */
  batchSize: positive(5_000),
  /** Statements per run: whatever is left is the next night's. */
  maxBatches: positive(200),
});

export type RetentionConfig = z.infer<typeof schema>;

export const retentionConfig = registerAs('retention', () =>
  parseEnv('retention', schema, {
    hostNetworkDays: 'RETENTION_HOST_NETWORK_DAYS',
    hostTimelineDays: 'RETENTION_HOST_TIMELINE_DAYS',
    automationRunDays: 'RETENTION_AUTOMATION_RUN_DAYS',
    inboundEventDays: 'RETENTION_INBOUND_EVENT_DAYS',
    outboxDays: 'RETENTION_OUTBOX_DAYS',
    batchSize: 'RETENTION_BATCH_SIZE',
    maxBatches: 'RETENTION_MAX_BATCHES',
  }),
);
