import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { BOT_APPROVAL_NOTE_MAX } from '@oppenheimer/shared';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  BOT_APPROVAL_RESULT_MAX,
  BOT_APPROVAL_REVIEW_NOTE_MAX,
  BOT_APPROVAL_SUMMARY_MAX,
} from '../domain/bot-approval.entity';

/**
 * One call of an asking tool waiting for the bot's owner
 * (`1791002200000-AddBotApprovals`, `1791002900000-AddBotApprovalSession`,
 * `1791003600000-AddBotApprovalWorkspaceIndex`, `1791004700000-AddBotPermissions`).
 */
@Entity('bot_approval')
@Index('IDX_bot_approval_bot', ['organizationId', 'botId', 'createdAt', 'id'])
@Index('IDX_bot_approval_org_status', ['organizationId', 'status', 'createdAt', 'id'])
@Index('UQ_bot_approval_pending', ['botId'], { unique: true, where: `"status" = 'pending'` })
@Index('IDX_bot_approval_turn', ['organizationId', 'turnId'])
@Index('IDX_bot_approval_decided_by', ['decidedByUserId'], {
  where: '"decidedByUserId" IS NOT NULL',
})
@Index('IDX_bot_approval_session', ['organizationId', 'sessionId'], {
  where: '"sessionId" IS NOT NULL',
})
@Check(
  'CHK_bot_approval_status',
  `"status" IN ('pending', 'approved', 'denied', 'expired', 'failed')`,
)
@Check('CHK_bot_approval_tool', `char_length("tool") > 0`)
@Check('CHK_bot_approval_summary', `char_length("summary") > 0`)
@Check('CHK_bot_approval_decided', `("status" = 'pending') = ("decidedAt" IS NULL)`)
@Check(
  'CHK_bot_approval_subject',
  `num_nonnulls("subjectKind", "subjectKey", "subjectLabel") IN (0, 3)`,
)
@Check('CHK_bot_approval_reach', `"reach" IS NULL OR "reach" IN ('once', 'tool', 'subject')`)
export class BotApprovalOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'uuid' })
  turnId!: string;

  @Column({ type: 'varchar', length: 64 })
  tool!: string;

  /** The call's validated input, read whole. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  input!: Record<string, unknown>;

  @Column({ type: 'varchar', length: BOT_APPROVAL_SUMMARY_MAX })
  summary!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: string;

  @Column({ type: 'varchar', length: BOT_APPROVAL_RESULT_MAX, nullable: true })
  result!: string | null;

  /** The session the call started when it ran on the yes; null when it started none. */
  @Column({ type: 'uuid', nullable: true })
  sessionId!: string | null;

  @Column({ type: 'varchar', length: BOT_APPROVAL_NOTE_MAX, nullable: true })
  note!: string | null;

  /** What the call acts on, when its tool names one: the three set together or none. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  subjectKind!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  subjectKey!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  subjectLabel!: string | null;

  @Column({ type: 'boolean', default: false })
  sharesOutside!: boolean;

  @Column({ type: 'boolean', default: false })
  perCallOnly!: boolean;

  @Column({ type: 'varchar', length: BOT_APPROVAL_REVIEW_NOTE_MAX, nullable: true })
  reviewNote!: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  reach!: string | null;

  @Column({ type: 'uuid', nullable: true })
  decidedByUserId!: string | null;

  /** The deciding credential's scopes, read whole; null for a browser session. */
  @Column({ type: 'jsonb', nullable: true })
  decidedWithScopes!: string[] | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  decidedAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
