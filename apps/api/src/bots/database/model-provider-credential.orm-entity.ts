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
 * A workspace's key for one model provider (`1791001700000-AddBotProviders`).
 * One per workspace and provider; the key is sealed, never stored in the clear.
 */
@Entity('model_provider_credential')
@Unique('UQ_model_provider_credential_provider', ['organizationId', 'provider'])
@Index('IDX_model_provider_credential_updated_by', ['updatedByUserId'], {
  where: '"updatedByUserId" IS NOT NULL',
})
@Index('UQ_model_provider_credential_default', ['organizationId'], {
  unique: true,
  where: '"isDefault"',
})
@Check('CHK_model_provider_credential_provider', `"provider" IN ('anthropic', 'glm', 'openai')`)
export class ModelProviderCredentialOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 16 })
  provider!: string;

  @Column({ type: 'bytea' })
  sealedKey!: Buffer;

  @Column({ type: 'varchar', length: 4 })
  keyHint!: string;

  /** The provider new bots start on (`1791002300000-AddModelProviderDefault`); one per workspace at most. */
  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ type: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
