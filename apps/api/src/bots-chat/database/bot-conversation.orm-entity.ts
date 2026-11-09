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
 * One of a bot's conversations (`1794241820830-AnswerOnTelegram`): its
 * console chat, whose id is the bot's own, or a Telegram chat with the bot
 * from one `/new` to the next. A Telegram chat's account is null once that
 * Telegram bot was disconnected; its history stays the bot's.
 */
@Entity('bot_conversation')
@Unique('UQ_bot_conversation_organization_id', ['organizationId', 'id'])
@Index('IDX_bot_conversation_bot', ['organizationId', 'botId'])
@Index(
  'UQ_bot_conversation_telegram_chat',
  ['telegramAccountId', 'chatId', 'botId', 'startsAtMessageId'],
  { unique: true, where: '"telegramAccountId" IS NOT NULL' },
)
@Index('IDX_bot_conversation_telegram_account', ['organizationId', 'telegramAccountId'], {
  where: '"telegramAccountId" IS NOT NULL',
})
@Check('CHK_bot_conversation_kind', `kind IN ('console', 'telegram')`)
@Check('CHK_bot_conversation_console', `(kind = 'console') = (id = "botId")`)
@Check(
  'CHK_bot_conversation_telegram',
  `(kind = 'telegram') = ("chatId" IS NOT NULL AND "startsAtMessageId" IS NOT NULL)`,
)
@Check('CHK_bot_conversation_console_account', `kind = 'telegram' OR "telegramAccountId" IS NULL`)
export class BotConversationOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_bot_conversation' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: 'console' | 'telegram';

  @Column({ type: 'uuid', nullable: true })
  telegramAccountId!: string | null;

  @Column({ type: 'varchar', length: 21, nullable: true })
  chatId!: string | null;

  /**
   * The Telegram message id the conversation starts at: 0 for a chat's first,
   * a `/new`'s own id after it. It holds the chat's messages up to the next
   * conversation's start.
   */
  @Column({ type: 'bigint', nullable: true })
  startsAtMessageId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
