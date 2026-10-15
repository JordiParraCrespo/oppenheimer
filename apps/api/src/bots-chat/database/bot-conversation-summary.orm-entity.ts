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
import { BOT_SUMMARY_MAX } from '../domain/bot-summary.policy';

/** A bot's conversation summary, one per bot (`1791002500000-AddBotConversationSummaries`). */
@Entity('bot_conversation_summary')
@Index('IDX_bot_conversation_summary_message', ['coversThroughMessageId'])
@Check('CHK_bot_conversation_summary_content', `char_length("content") > 0`)
@Check('CHK_bot_conversation_summary_version', `"version" >= 1`)
export class BotConversationSummaryOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_bot_conversation_summary' })
  organizationId!: string;

  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_bot_conversation_summary' })
  botId!: string;

  @Column({ type: 'varchar', length: BOT_SUMMARY_MAX })
  content!: string;

  @Column({ type: 'uuid' })
  coversThroughMessageId!: string;

  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  coversThroughCreatedAt!: Date;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
