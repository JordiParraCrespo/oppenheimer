import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** A webhook delivery as it arrived (`1790500000000-AddInboundEvents`). */
@Entity('inbound_delivery')
@Unique('UQ_inbound_delivery_source_delivery', ['source', 'deliveryId'])
@Index('IDX_inbound_delivery_received_brin', { synchronize: false })
@Index('IDX_inbound_delivery_unprocessed', ['receivedAt'], { where: `"status" = 'received'` })
export class InboundDeliveryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  source!: string;

  @Column({ type: 'varchar', length: 128 })
  deliveryId!: string;

  @Column({ type: 'varchar', length: 64 })
  eventName!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 16, default: 'received' })
  status!: 'received' | 'processed' | 'failed';

  @Column({ type: 'integer', default: 0 })
  eventCount!: number;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  receivedAt!: Date;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  processedAt!: Date | null;

  /** When the sweep last re-staged its processing, if it ever had to. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  restagedAt!: Date | null;
}
