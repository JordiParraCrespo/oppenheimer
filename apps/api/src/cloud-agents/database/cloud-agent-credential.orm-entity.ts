import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { CloudAgentProviderId } from '@oppenheimer/shared';
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
 * A person's key for one cloud agent vendor (`product/next-steps/cloud-agents.md`),
 * one per person, workspace and vendor. The key is sealed with AES-256-GCM under
 * `CLOUD_AGENTS_KEY`; what the vendor said about it when it was stored (its name,
 * the account) is kept beside it so Settings can say whose it is without asking.
 */
@Entity('cloud_agent_credential')
@Unique('UQ_cloud_agent_credential_user_provider', ['organizationId', 'userId', 'provider'])
@Index('IDX_cloud_agent_credential_user', ['userId'])
@Check('CHK_cloud_agent_credential_provider', `"provider" IN ('cursor')`)
export class CloudAgentCredentialOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 16 })
  provider!: CloudAgentProviderId;

  @Column({ type: 'bytea' })
  sealedKey!: Buffer;

  @Column({ type: 'varchar', length: 8 })
  keyHint!: string;

  @Column({ type: 'varchar', length: 100 })
  keyName!: string;

  @Column({ type: 'varchar', length: 320, nullable: true })
  accountEmail!: string | null;

  /** The vendor's id for the account, the bucket its rate limit counts; null for a key that names no person. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  accountId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
