import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
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
 * A workspace's key for a model provider (`1791001700000-AddBotProviders`).
 * A provider may hold several, in order (`1795871743323-AddModelProviderKeyFailover`);
 * the key is sealed, never stored in the clear.
 */
@Entity('model_provider_credential')
@Index('IDX_model_provider_credential_order', ['organizationId', 'provider', 'position'])
@Index('IDX_model_provider_credential_updated_by', ['updatedByUserId'], {
  where: '"updatedByUserId" IS NOT NULL',
})
@Index('UQ_model_provider_credential_default', ['organizationId'], {
  unique: true,
  where: '"markedDefault"',
})
@Check(
  'CHK_model_provider_credential_provider',
  `"provider" IN ('anthropic', 'glm', 'openai', 'chatgpt', 'xai', 'groq', 'elevenlabs')`,
)
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

  /** The provider new bots start on (`1791002800000-AddModelProviderDefault`); one per workspace at most. */
  @Column({ type: 'boolean', default: false })
  markedDefault!: boolean;

  /** Where the key stands among its provider's: a turn tries the lowest first. Ties go to the older row. */
  @Column({ type: 'smallint', default: 0 })
  position!: number;

  /** When a turn on it was refused for credit or quota; null while it is not known to be spent. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  spentAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
