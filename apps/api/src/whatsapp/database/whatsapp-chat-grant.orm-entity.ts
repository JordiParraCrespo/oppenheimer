import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { WhatsappChatKind } from '@oppenheimer/shared';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A chat the owner allowed on one of their numbers besides their own: a group
 * or another person, and the bot that answers there (null for the number's
 * default). Goes with the number (`CASCADE`); a bot that answers in one is
 * not deleted (`NO ACTION`, `BOTS_043`).
 */
@Entity('whatsapp_chat_grant')
@Index('UQ_whatsapp_chat_grant_chat', ['accountId', 'chatId'], { unique: true })
@Index('IDX_whatsapp_chat_grant_account', ['organizationId', 'accountId', 'createdAt'])
@Index('IDX_whatsapp_chat_grant_bot', ['organizationId', 'botId'], {
  where: '"botId" IS NOT NULL',
})
@Index('IDX_whatsapp_chat_grant_granted_by_bot', ['grantedByBotId'], {
  where: '"grantedByBotId" IS NOT NULL',
})
@Check('CHK_whatsapp_chat_grant_chat_kind', `"chatKind" IN ('direct', 'group')`)
export class WhatsappChatGrantOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  accountId!: string;

  /** The chat's JID: a person's `<digits>@s.whatsapp.net` or a group's `…@g.us`. */
  @Column({ type: 'varchar', length: 128 })
  chatId!: string;

  @Column({ type: 'varchar', length: 8 })
  chatKind!: WhatsappChatKind;

  @Column({ type: 'varchar', length: 200, nullable: true })
  chatName!: string | null;

  /** The bot that answers here; null for the number's default. */
  @Column({ type: 'uuid', nullable: true })
  botId!: string | null;

  /** The bot whose tool allowed it; null when allowed in Settings. `SET NULL` when it is deleted. */
  @Column({ type: 'uuid', nullable: true })
  grantedByBotId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
