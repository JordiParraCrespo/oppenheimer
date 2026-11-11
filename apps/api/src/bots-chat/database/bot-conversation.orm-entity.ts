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

/** What a conversation is: the console chat, or a channel's chat with the bot. */
export type BotConversationKind = 'console' | 'telegram' | 'whatsapp';

/**
 * One of a bot's conversations (`1794241820830-AnswerOnTelegram`,
 * `1794256897181-AnswerOnWhatsapp`): its console chat, whose id is the bot's
 * own, or a channel's chat with the bot (Telegram, WhatsApp) from one start
 * to the next. A channel chat's account is null once it was disconnected;
 * its history stays the bot's.
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
@Index(
  'UQ_bot_conversation_whatsapp_chat',
  ['whatsappAccountId', 'chatId', 'botId', 'startsAtMessageId'],
  { unique: true, where: '"whatsappAccountId" IS NOT NULL' },
)
@Index('IDX_bot_conversation_whatsapp_account', ['organizationId', 'whatsappAccountId'], {
  where: '"whatsappAccountId" IS NOT NULL',
})
@Check('CHK_bot_conversation_kind', `kind IN ('console', 'telegram', 'whatsapp')`)
@Check('CHK_bot_conversation_console', `(kind = 'console') = (id = "botId")`)
@Check(
  'CHK_bot_conversation_channel',
  `(kind = 'console') = ("chatId" IS NULL) AND ("chatId" IS NULL) = ("startsAtMessageId" IS NULL)`,
)
@Check(
  'CHK_bot_conversation_account',
  `(kind = 'telegram' OR "telegramAccountId" IS NULL) AND (kind = 'whatsapp' OR "whatsappAccountId" IS NULL)`,
)
export class BotConversationOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_bot_conversation' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: BotConversationKind;

  @Column({ type: 'uuid', nullable: true })
  telegramAccountId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  whatsappAccountId!: string | null;

  /** The chat's id on its channel: Telegram's number, or WhatsApp's JID. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  chatId!: string | null;

  /**
   * The message the conversation starts at, in the chat's order: Telegram's
   * message id, or the `whatsapp_message.seq`; 0 for a chat's first. It
   * holds the chat's messages up to the next conversation's start.
   */
  @Column({ type: 'bigint', nullable: true })
  startsAtMessageId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
