import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Persistence model for `host_presence`: whether the machine is there, and its
 * last live numbers. One narrow row per host, rewritten on every heartbeat.
 *
 * Nothing a heartbeat writes is indexed, and the table is `fillfactor = 70`
 * (set in the migration; TypeORM cannot say it), so each beat is a HOT update.
 * Adding an index on any of these columns ends that; think twice.
 */
@Entity('host_presence')
@Check('CHK_host_presence_round_trip', `"roundTripMillis" IS NULL OR "roundTripMillis" >= 0`)
@Check('CHK_host_presence_load', `"loadAverage" IS NULL OR "loadAverage" >= 0`)
@Check('CHK_host_presence_memory', `"memoryAvailableBytes" IS NULL OR "memoryAvailableBytes" >= 0`)
@Check('CHK_host_presence_disk', `"diskFreeBytes" IS NULL OR "diskFreeBytes" >= 0`)
@Index('IDX_host_presence_current_network', ['currentNetworkId'], {
  where: '"currentNetworkId" IS NOT NULL',
})
export class HostPresenceOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_host_presence' })
  hostId!: string;

  /** The network of the link that is up, or was last up. Changes on connect only. */
  @Column({ type: 'uuid', nullable: true })
  currentNetworkId!: string | null;

  /** When the current (or last) link opened. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  connectedAt!: Date | null;

  /** Last hello or heartbeat, by this process's clock. `online` is derived from it. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  lastSeenAt!: Date;

  /** The link's last ping/pong, measured by the replica holding it. */
  @Column({ type: 'integer', nullable: true })
  roundTripMillis!: number | null;

  /** One-minute load average. `numeric` comes back from `pg` as a string. */
  @Column({ type: 'numeric', precision: 7, scale: 2, nullable: true })
  loadAverage!: string | null;

  @Column({ type: 'bigint', nullable: true })
  memoryAvailableBytes!: string | null;

  @Column({ type: 'bigint', nullable: true })
  diskFreeBytes!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
