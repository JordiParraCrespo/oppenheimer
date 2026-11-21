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
 * A chat a linked number can be reached in before anyone writes there, as its
 * host's device reports it (`whatsapp.chats`): a group it is in, or a person
 * among its contacts. Settings lists them beside the chats it has seen. Goes
 * with the number (`CASCADE`).
 */
@Entity('whatsapp_known_chat')
@Index('UQ_whatsapp_known_chat_chat', ['accountId', 'chatId'], { unique: true })
@Index('IDX_whatsapp_known_chat_account', ['organizationId', 'accountId', 'updatedAt'])
@Check('CHK_whatsapp_known_chat_chat_kind', `"chatKind" IN ('direct', 'group')`)
export class WhatsappKnownChatOrmEntity {
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

  /** The group's subject, or the contact's saved name, as the device last reported it. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  chatName!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  /** When the device last reported it; a chat it stops reporting is deleted once this is stale. */
  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
