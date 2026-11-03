import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A workspace's Sentry organization (`product/next-steps/sentry.md`), one per
 * workspace. The client secret is sealed with AES-256-GCM under
 * `SENTRY_CONNECTION_KEY`: it is what every webhook's signature is checked
 * with, and it is never returned.
 */
@Entity('sentry_connection')
@Index('UQ_sentry_connection_organization', ['organizationId'], { unique: true })
@Index('IDX_sentry_connection_created_by', ['createdByUserId'])
export class SentryConnectionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 64 })
  organizationSlug!: string;

  @Column({ type: 'bytea' })
  sealedClientSecret!: Buffer;

  @Column({ type: 'varchar', length: 8 })
  secretHint!: string;

  @Column({ type: 'uuid' })
  createdByUserId!: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
