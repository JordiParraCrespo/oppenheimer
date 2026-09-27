import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

export const HOST_EVENT_KINDS = [
  'paired',
  'renamed',
  'unpaired',
  'facts_changed',
  'network_changed',
  'runner_updated',
  'runner_rolled_back',
] as const;

export type HostEventKind = (typeof HOST_EVENT_KINDS)[number];

/**
 * Persistence model for `host_event`: what changed about a host, and when.
 * Append-only — no `updatedAt` — and kept 180 days. It grows with changes, not
 * heartbeats. The key is an identity, so inserts append to the end of the
 * primary key rather than scattering across it.
 */
@Entity('host_event')
@Check(
  'CHK_host_event_kind',
  `"kind" IN ('paired', 'renamed', 'unpaired', 'facts_changed', 'network_changed', 'runner_updated', 'runner_rolled_back')`,
)
@Check('CHK_host_event_payload_object', `jsonb_typeof("payload") = 'object'`)
@Index('IDX_host_event_host_occurred', ['hostId', 'occurredAt', 'id'])
@Index('IDX_host_event_occurred_brin', { synchronize: false })
export class HostEventOrmEntity {
  /** `GENERATED ALWAYS AS IDENTITY`; `bigint` comes back from `pg` as a string. */
  @PrimaryColumn({
    type: 'bigint',
    generated: 'identity',
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'PK_host_event',
  })
  id!: string;

  @Column({ type: 'uuid' })
  hostId!: string;

  @Column({ type: 'varchar', length: 32 })
  kind!: HostEventKind;

  /** The change itself: the facts diff, the old and new name, the two versions. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload!: Record<string, unknown>;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, default: () => 'now()' })
  occurredAt!: Date;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
