import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, PrimaryColumn, Unique, UpdateDateColumn } from 'typeorm';

/**
 * A routine's webhook URL: one per routine, apart from its triggers, which an
 * edit rewrites. Only the token's SHA-256 is kept (the token is shown once);
 * the signing secret is sealed, since an HMAC is checked with it whole.
 */
@Entity('automation_webhook')
@Unique('UQ_automation_webhook_token_hash', ['tokenHash'])
export class AutomationWebhookOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_automation_webhook' })
  organizationId!: string;

  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_automation_webhook' })
  automationId!: string;

  @Column({ type: 'char', length: 64 })
  tokenHash!: string;

  /** The token's first characters, to tell one URL from the next; not a secret. */
  @Column({ type: 'varchar', length: 16 })
  tokenPrefix!: string;

  @Column({ type: 'bytea', nullable: true })
  signingSecretSealed!: Buffer | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  lastReceivedAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
