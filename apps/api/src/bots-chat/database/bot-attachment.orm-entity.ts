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

/** An image uploaded to a bot's chat (`1791003200000-AddBotAttachments`). */
@Entity('bot_attachment')
@Index('IDX_bot_attachment_message', ['messageId'])
@Index('IDX_bot_attachment_uploaded_by', ['uploadedByUserId'])
@Index('IDX_bot_attachment_unclaimed', ['createdAt'], { where: '"messageId" IS NULL' })
@Check(
  'CHK_bot_attachment_mime_type',
  `"mimeType" IN ('image/png', 'image/jpeg', 'image/gif', 'image/webp')`,
)
@Check('CHK_bot_attachment_size', `"sizeBytes" > 0 AND "sizeBytes" <= 5242880`)
export class BotAttachmentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  /** Who may send it; null once that account is deleted. */
  @Column({ type: 'uuid', nullable: true })
  uploadedByUserId!: string | null;

  /** The message that carries it; null until it is sent, and again once that message is gone. */
  @Column({ type: 'uuid', nullable: true })
  messageId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  storageKey!: string;

  @Column({ type: 'varchar', length: 16 })
  mimeType!: string;

  @Column({ type: 'integer' })
  sizeBytes!: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  name!: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
