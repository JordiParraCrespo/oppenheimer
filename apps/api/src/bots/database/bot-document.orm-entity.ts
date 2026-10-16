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

/** A bot's current `soul` or `instructions`. `revision` is what a save is conditioned on. */
@Entity('bot_document')
@Index('IDX_bot_document_updated_by', ['updatedByUserId'], {
  where: '"updatedByUserId" IS NOT NULL',
})
@Check('CHK_bot_document_name', `"name" IN ('soul', 'instructions')`)
@Check('CHK_bot_document_content', `char_length("content") <= 32768`)
@Check('CHK_bot_document_revision', `"revision" >= 1`)
@Check('CHK_bot_document_updated_by', `"updatedBy" IN ('user', 'bot')`)
@Check('CHK_bot_document_bot_has_no_user', `"updatedBy" = 'user' OR "updatedByUserId" IS NULL`)
export class BotDocumentOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  organizationId!: string;

  @PrimaryColumn({ type: 'uuid' })
  botId!: string;

  @PrimaryColumn({ type: 'varchar', length: 16 })
  name!: string;

  @Column({ type: 'text', default: '' })
  content!: string;

  @Column({ type: 'integer', default: 1 })
  revision!: number;

  @Column({ type: 'varchar', length: 8, default: 'user' })
  updatedBy!: string;

  @Column({ type: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
