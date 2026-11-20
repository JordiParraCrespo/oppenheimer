import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { SlackAccountStatus } from '@oppenheimer/shared';
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
 * A bot's own Slack app (`1795193700000-AddSlack`): one per bot, its bot token
 * and signing secret sealed under `SLACK_TOKEN_KEY`, and the one Slack user it
 * answers once a `link` code recorded them.
 */
@Entity('slack_account')
@Index('UQ_slack_account_organization_id', ['organizationId', 'id'], { unique: true })
@Index('UQ_slack_account_bot', ['botId'], { unique: true })
@Index('UQ_slack_account_app', ['teamId', 'botUserId'], { unique: true })
@Index('IDX_slack_account_owner', ['organizationId', 'userId'])
@Index('IDX_slack_account_user', ['userId'])
@Check(
  'CHK_slack_account_owner_link',
  `("ownerLinkCodeHash" IS NULL) = ("ownerLinkExpiresAt" IS NULL)`,
)
@Check('CHK_slack_account_status', `"status" IN ('connected', 'revoked')`)
export class SlackAccountOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'varchar', length: 16, default: 'connected' })
  status!: SlackAccountStatus;

  @Column({ type: 'varchar', length: 200, nullable: true })
  statusReason!: string | null;

  @Column({ type: 'varchar', length: 32 })
  teamId!: string;

  @Column({ type: 'varchar', length: 200 })
  teamName!: string;

  @Column({ type: 'varchar', length: 32 })
  botUserId!: string;

  @Column({ type: 'varchar', length: 200 })
  botName!: string;

  @Column({ type: 'bytea' })
  sealedBotToken!: Buffer;

  @Column({ type: 'bytea' })
  sealedSigningSecret!: Buffer;

  @Column({ type: 'varchar', length: 8 })
  tokenHint!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  ownerSlackUserId!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ownerLinkCodeHash!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  ownerLinkExpiresAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
