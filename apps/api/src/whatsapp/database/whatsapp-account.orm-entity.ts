import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { WhatsappAccountStatus } from '@oppenheimer/shared';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A number a person linked as a WhatsApp device on one of their hosts
 * (`product/next-steps/whatsapp.md` §1). One per host, since a runner holds
 * one device; the device's keys stay on the host and are never here.
 */
@Entity('whatsapp_account')
@Index('UQ_whatsapp_account_host', ['hostId'], { unique: true })
@Index('UQ_whatsapp_account_organization_id', ['organizationId', 'id'], { unique: true })
@Index('IDX_whatsapp_account_owner', ['organizationId', 'userId'])
@Index('IDX_whatsapp_account_user', ['userId'])
@Check(
  'CHK_whatsapp_account_status',
  `"status" IN ('pairing', 'connecting', 'connected', 'logged_out', 'unlinked')`,
)
export class WhatsappAccountOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  hostId!: string;

  @Column({ type: 'varchar', length: 64 })
  label!: string;

  @Column({ type: 'varchar', length: 16, default: 'pairing' })
  status!: WhatsappAccountStatus;

  @Column({ type: 'varchar', length: 128, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  displayName!: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  qr!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  qrExpiresAt!: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  statusReason!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
