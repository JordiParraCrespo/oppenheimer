import { EntitySchema } from 'typeorm';

/**
 * Delivery channel for an outbox row. `event` rows are re-emitted in-process
 * (EventEmitter2 in apps/api); `queue` rows are handed to a BullMQ queue named
 * by `topic`.
 */
export type OutboxChannel = 'event' | 'queue';

/**
 * `pending` rows are waiting to be delivered (possibly leased by a relay);
 * `processed` rows were delivered; `failed` rows exhausted their attempts and
 * are kept for inspection rather than silently dropped.
 */
export type OutboxMessageStatus = 'pending' | 'processed' | 'failed';

export const OUTBOX_TABLE = 'outbox_message';

/**
 * One owed side effect, written in the same database transaction as the state
 * change that owes it. The row *is* the message: it survives the process
 * dying, a redeploy, or Redis being unreachable at commit time.
 *
 * `aggregateId` is a plain column with no foreign key — deliberately, so the
 * queue outlives the records it names (a deleted aggregate's events must still
 * deliver).
 */
export interface OutboxMessageRecord {
  id: string;
  channel: OutboxChannel;
  /** Queue name for `queue` rows; null for in-process `event` rows. */
  topic: string | null;
  /** Domain-event class name or BullMQ job name. */
  eventName: string;
  aggregateId: string | null;
  payload: Record<string, unknown>;
  /**
   * Why this row exists, in words — so a queued item is self-explaining when
   * someone opens the table at 2am.
   */
  reason: string;
  status: OutboxMessageStatus;
  /** Delivery attempts so far; incremented when a relay claims the row. */
  attempts: number;
  /** Earliest time a relay may claim the row (drives retry backoff). */
  availableAt: Date;
  /** Relay instance currently holding the lease, for observability. */
  lockedBy: string | null;
  /** Lease expiry: a row whose lease lapsed is reclaimed, never stuck. */
  lockedUntil: Date | null;
  lastError: string | null;
  correlationId: string | null;
  createdAt: Date;
  processedAt: Date | null;
}

/**
 * Persistence model for the outbox, declared as an `EntitySchema` so this
 * library package stays decorator-free. Register it in the consuming app
 * (`TypeOrmModule.forFeature([OutboxMessageSchema])`); the table itself is
 * created by a migration in the app, mirroring these columns.
 */
export const OutboxMessageSchema = new EntitySchema<OutboxMessageRecord>({
  name: 'OutboxMessage',
  tableName: OUTBOX_TABLE,
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    channel: { type: 'varchar', length: 16, default: 'event' },
    topic: { type: 'varchar', nullable: true },
    eventName: { type: 'varchar' },
    aggregateId: { type: 'varchar', nullable: true },
    payload: { type: 'jsonb' },
    reason: { type: 'text' },
    status: { type: 'varchar', length: 16, default: 'pending' },
    attempts: { type: 'int', default: 0 },
    availableAt: { type: 'timestamp', default: () => 'now()' },
    lockedBy: { type: 'varchar', nullable: true },
    lockedUntil: { type: 'timestamp', nullable: true },
    lastError: { type: 'text', nullable: true },
    correlationId: { type: 'varchar', nullable: true },
    createdAt: { type: 'timestamp', createDate: true },
    processedAt: { type: 'timestamp', nullable: true },
  },
  indices: [
    // The relay's claim query filters on exactly this pair.
    {
      name: 'IDX_outbox_message_status_available',
      columns: ['status', 'availableAt'],
    },
  ],
});
