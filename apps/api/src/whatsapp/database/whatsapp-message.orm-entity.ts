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
@Check('CHK_whatsapp_message_chat_kind', `"chatKind" IN ('direct', 'group')`)
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

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
