import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { TelegramAccountStatus } from '@oppenheimer/shared';
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
 * A Telegram bot a person connected on one of their hosts
 * (`product/next-steps/telegram.md` §2). One per host, since a runner polls
 * one; the bot's token stays on the host and is never here.
 */
@Entity('telegram_account')
@Index('UQ_telegram_account_host', ['hostId'], { unique: true })
@Index('UQ_telegram_account_organization_id', ['organizationId', 'id'], { unique: true })
@Index('IDX_telegram_account_owner', ['organizationId', 'userId'])
@Index('IDX_telegram_account_user', ['userId'])
@Index('IDX_telegram_account_answering_bot', ['organizationId', 'answeringBotId'], {
  where: '"answeringBotId" IS NOT NULL',
})
@Check(
  'CHK_telegram_account_owner_link',
  `("ownerLinkCodeHash" IS NULL) = ("ownerLinkExpiresAt" IS NULL)`,
)
@Check(
  'CHK_telegram_account_status',
  `"status" IN ('connecting', 'connected', 'revoked', 'unlinked')`,
)
export class TelegramAccountOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  hostId!: string;

  @Column({ type: 'varchar', length: 64 })
  label!: string;

  @Column({ type: 'varchar', length: 16, default: 'connecting' })
  status!: TelegramAccountStatus;

  @Column({ type: 'varchar', length: 21, nullable: true })
  botId!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  username!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  displayName!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  statusReason!: string | null;

  /** The Oppenheimer bot that answers here (`1794241820830-AnswerOnTelegram`). */
  @Column({ type: 'uuid', nullable: true })
  answeringBotId!: string | null;

  @Column({ type: 'varchar', length: 21, nullable: true })
  ownerTelegramId!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ownerLinkCodeHash!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  ownerLinkExpiresAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
