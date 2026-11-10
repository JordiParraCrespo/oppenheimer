import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { WhatsappMediaKind } from '@oppenheimer/shared/protocol';
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One message a linked number saw or sent (`product/next-steps/whatsapp.md`
 * §3), kept so the owner's bots can read the chat: WhatsApp has no API to ask
 * a linked device's history of. Kept for `WHATSAPP_RETENTION_DAYS`, and goes
 * with its account.
 */
@Entity('whatsapp_message')
@Index('UQ_whatsapp_message_external', ['organizationId', 'accountId', 'chatId', 'externalId'], {
  unique: true,
})
@Index('IDX_whatsapp_message_chat', ['organizationId', 'accountId', 'chatId', 'sentAt'])
@Index('IDX_whatsapp_message_account_sent', ['organizationId', 'accountId', 'sentAt'])
@Index('IDX_whatsapp_message_bot', ['sentByBotId'], { where: '"sentByBotId" IS NOT NULL' })
/** A chat's switches to a bot by name, by `seq` (`1794256897181-AnswerOnWhatsapp`). */
@Index('IDX_whatsapp_message_switch', ['organizationId', 'accountId', 'chatId', 'seq'], {
  where: '"switchesToBotId" IS NOT NULL',
})
/** A chat's `/new` commands, by `seq`. */
@Index('IDX_whatsapp_message_new', { synchronize: false })
@Index('IDX_whatsapp_message_switches_to_bot', ['switchesToBotId'], {
  where: '"switchesToBotId" IS NOT NULL',
})
@Check('CHK_whatsapp_message_chat_kind', `"chatKind" IN ('direct', 'group')`)
// Not on `sentByBotId`: deleting the bot sets it null and keeps the reply.
@Check('CHK_whatsapp_message_reply', `NOT "isReply" OR "fromMe"`)
export class WhatsappMessageOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  accountId!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 128 })
  externalId!: string;

  @Column({ type: 'varchar', length: 128 })
  chatId!: string;

  @Column({ type: 'varchar', length: 8 })
  chatKind!: 'direct' | 'group';

  @Column({ type: 'varchar', length: 200, nullable: true })
  chatName!: string | null;

  @Column({ type: 'varchar', length: 128 })
  senderId!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  senderName!: string | null;

  @Column({ type: 'boolean' })
  fromMe!: boolean;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  media!: WhatsappMediaKind | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  quotedId!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  sentAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  sentByBotId!: string | null;

  /**
   * The order the control plane stored it in (`GENERATED ALWAYS AS
   * IDENTITY`): what a WhatsApp conversation starts at, since WhatsApp's own
   * ids are not ordered. `bigint` comes back from `pg` as a string.
   */
  @Column({ type: 'bigint', generated: 'identity', generatedIdentity: 'ALWAYS' })
  seq!: string;

  /** The bot the owner's "Name: …" switched the chat to, resolved when it was stored. */
  @Column({ type: 'uuid', nullable: true })
  switchesToBotId!: string | null;

  /** The bot's answer to the owner's message, which does not count toward its sends a day. */
  @Column({ type: 'boolean', default: false })
  isReply!: boolean;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
