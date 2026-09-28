import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** One normalized event in one workspace (`1790500000000-AddInboundEvents`). Append-only. */
@Entity('inbound_event')
@Unique('UQ_inbound_event_organization_external', ['organizationId', 'source', 'externalId'])
@Unique('UQ_inbound_event_organization_id', ['organizationId', 'id'])
@Index('IDX_inbound_event_preview', [
  'organizationId',
  'source',
  'eventType',
  'subjectRef',
  'occurredAt',
])
@Index('IDX_inbound_event_delivery', ['inboundDeliveryId'])
@Index('IDX_inbound_event_received_brin', { synchronize: false })
export class InboundEventOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid', nullable: true })
  inboundDeliveryId!: string | null;

  @Column({ type: 'varchar', length: 32 })
  source!: string;

  @Column({ type: 'varchar', length: 200 })
  externalId!: string;

  @Column({ type: 'varchar', length: 64 })
  eventType!: string;

  @Column({ type: 'varchar', length: 32 })
  subjectKind!: string;

  @Column({ type: 'varchar', length: 128 })
  subjectRef!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actorLogin!: string | null;

  @Column({ type: 'boolean', default: false })
  actorIsOwnApp!: boolean;

  @Column({ type: 'jsonb', default: {} })
  attributes!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  context!: Record<string, unknown>;

  @Column({ type: 'smallint', default: 1 })
  schemaVersion!: number;

  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  occurredAt!: Date;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  receivedAt!: Date;
}
