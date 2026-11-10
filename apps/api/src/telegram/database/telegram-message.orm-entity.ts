import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { TelegramMediaKind } from '@oppenheimer/shared/protocol';
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One message a Telegram bot received or sent (`product/next-steps/telegram.md`
 * §4), kept so the owner's bots can read the chat: the Bot API has no history
 * to ask. Kept for `TELEGRAM_RETENTION_DAYS`, and goes with its account.
 */
@Entity('telegram_message')
@Index('UQ_telegram_message_external', ['organizationId', 'accountId', 'chatId', 'externalId'], {
  unique: true,
})
@Index('IDX_telegram_message_chat', ['organizationId', 'accountId', 'chatId', 'sentAt'])
@Index('IDX_telegram_message_account_sent', ['organizationId', 'accountId', 'sentAt'])
@Index('IDX_telegram_message_bot', ['sentByBotId'], { where: '"sentByBotId" IS NOT NULL' })
/** The `/new` commands of a chat by Telegram's id (`1794241820830-AnswerOnTelegram`). */
@Index('IDX_telegram_message_new', { synchronize: false })
@Check('CHK_telegram_message_chat_kind', `"chatKind" IN ('direct', 'group')`)
export class TelegramMessageOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  accountId!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 21 })
  externalId!: string;

  @Column({ type: 'varchar', length: 21 })
  chatId!: string;

  @Column({ type: 'varchar', length: 8 })
  chatKind!: 'direct' | 'group';

  @Column({ type: 'varchar', length: 200, nullable: true })
  chatName!: string | null;

  @Column({ type: 'varchar', length: 21 })
  senderId!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  senderName!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  senderUsername!: string | null;

  @Column({ type: 'boolean' })
  fromBot!: boolean;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  media!: TelegramMediaKind | null;

  @Column({ type: 'varchar', length: 21, nullable: true })
  replyToId!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  sentAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  sentByBotId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
