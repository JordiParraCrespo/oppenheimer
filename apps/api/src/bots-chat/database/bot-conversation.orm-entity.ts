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
 * console chat, whose id is the bot's own, or a Telegram chat with the bot,
 * open until `/new` closes it. A Telegram chat's account is null once that
 * Telegram bot was disconnected; its history stays the bot's.
 */
@Entity('bot_conversation')
@Unique('UQ_bot_conversation_organization_id', ['organizationId', 'id'])
@Index('IDX_bot_conversation_bot', ['organizationId', 'botId'])
@Index('UQ_bot_conversation_telegram_chat', ['telegramAccountId', 'chatId'], {
  unique: true,
  where: '"archivedAt" IS NULL',
})
@Index('IDX_bot_conversation_telegram_account', ['organizationId', 'telegramAccountId'], {
  where: '"telegramAccountId" IS NOT NULL',
})
@Check('CHK_bot_conversation_kind', `kind IN ('console', 'telegram')`)
@Check('CHK_bot_conversation_console', `(kind = 'console') = (id = "botId")`)
@Check('CHK_bot_conversation_telegram', `(kind = 'telegram') = ("chatId" IS NOT NULL)`)
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

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
