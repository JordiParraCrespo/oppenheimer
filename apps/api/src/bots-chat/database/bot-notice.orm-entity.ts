import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { BOT_NOTICE_TEXT_MAX } from '@oppenheimer/shared';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** A bot's latest notice to the person (`1793707420933-AddBotNotices`). */
@Entity('bot_notice')
@Index('UQ_bot_notice_bot', ['organizationId', 'botId'], { unique: true })
@Index('IDX_bot_notice_org_updated', ['organizationId', 'updatedAt', 'id'])
@Check('CHK_bot_notice_text', `char_length(btrim("text")) > 0`)
export class BotNoticeOrmEntity {
  /** The notice's own id: a new one with each notice, though the row stays the bot's. */
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_bot_notice' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'varchar', length: BOT_NOTICE_TEXT_MAX })
  text!: string;

  /** When the bot first sent a notice. */
  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  /** When this notice came: the Inbox's time and order. */
  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
