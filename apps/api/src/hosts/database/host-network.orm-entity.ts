import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Persistence model for `host_network`: one row per public address a host has
 * connected from, as the API saw it on the link, with the geography resolved
 * then. A dimension bounded by where a machine actually goes, kept 90 days
 * past its last use unless it is the current one.
 */
@Entity('host_network')
@Unique('UQ_host_network_host_ip', ['hostId', 'ip'])
@Check('CHK_host_network_country', `"countryCode" ~ '^[A-Z]{2}$'`)
@Check('CHK_host_network_asn', `"asn" IS NULL OR "asn" > 0`)
@Check('CHK_host_network_seen_order', `"lastSeenAt" >= "firstSeenAt"`)
@Index('IDX_host_network_last_seen', ['lastSeenAt'])
export class HostNetworkOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_host_network' })
  id!: string;

  @Column({ type: 'uuid' })
  hostId!: string;

  @Column({ type: 'inet' })
  ip!: string;

  /** ISO 3166-1 alpha-2, upper case. */
  @Column({ type: 'char', length: 2, nullable: true })
  countryCode!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  region!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  city!: string | null;

  /** The autonomous system the address belongs to: the ISP or the cloud. */
  @Column({ type: 'integer', nullable: true })
  asn!: number | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  asnOrg!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, default: () => 'now()' })
  firstSeenAt!: Date;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, default: () => 'now()' })
  lastSeenAt!: Date;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
