import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
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
 * A bot's goal (`1791004900000-AddBotGoals`, widened by
 * `1793609253967-WidenBotGoals`, unbounded with its pause and budget by
 * `1794209397887-UnboundBotGoalsAndTurns`).
 */
@Entity('bot_goal')
@Index('UQ_bot_goal_bot', ['organizationId', 'botId'], { unique: true })
@Index('IDX_bot_goal_origin_turn', ['organizationId', 'originTurnId'])
@Check('CHK_bot_goal_objective', `char_length(objective) > 0`)
@Check('CHK_bot_goal_limit', `"limit" IS NULL OR "limit" >= 1`)
@Check(
  'CHK_bot_goal_continuations',
  `continuations >= 0 AND ("limit" IS NULL OR continuations <= "limit")`,
)
@Check(
  'CHK_bot_goal_tokens',
  `"tokensUsed" >= 0 AND ("tokenBudget" IS NULL OR "tokenBudget" >= 50000)`,
)
@Check('CHK_bot_goal_idle_turns', `"idleTurns" >= 0`)
@Check(
  'CHK_bot_goal_pause_reason',
  `"pauseReason" IS NULL OR "pauseReason" IN ('blocked', 'usage_limit', 'no_progress', 'budget', 'stopped', 'failed')`,
)
@Check('CHK_bot_goal_paused', `num_nonnulls("pausedAt", "pauseReason") IN (0, 2)`)
@Check('CHK_bot_goal_waiting', `num_nonnulls("waitingFor", "waitingUntil") IN (0, 2)`)
@Check(
  'CHK_bot_goal_credential_scopes',
  `"credentialScopes" IS NULL OR jsonb_typeof("credentialScopes") = 'array'`,
)
export class BotGoalOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_bot_goal' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  /** The bot's turn that set it. */
  @Column({ type: 'uuid' })
  originTurnId!: string;

  @Column({ type: 'varchar', length: 2000 })
  objective!: string;

  /** Null for a goal with no limit of continuations (every goal since 2026-11-09). */
  @Column({ type: 'integer', nullable: true })
  limit!: number | null;

  @Column({ type: 'integer', default: 0 })
  continuations!: number;

  /** bigint: the driver returns a string, which the mapper reads as a number. */
  @Column({ type: 'bigint', default: 0 })
  tokensUsed!: string;

  @Column({ type: 'bigint', nullable: true })
  tokenBudget!: string | null;

  @Column({ type: 'integer', default: 0 })
  idleTurns!: number;

  /** The bot's words when it said the goal is met; null when it has not. */
  @Column({ type: 'varchar', length: 1000, nullable: true })
  claim!: string | null;

  /** When it paused; null while it runs. Set with `pauseReason`, or null with it. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  pausedAt!: Date | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  pauseReason!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  pauseNote!: string | null;

  /** The setting turn's credential scopes; null for a browser session. */
  @Column({ type: 'jsonb', nullable: true })
  credentialScopes!: string[] | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  timeZone!: string | null;

  /** The system whose rate limit holds the goal's next decision; null when none does. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  waitingFor!: string | null;

  /** When the held decision runs; set with `waitingFor`, or null with it. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  waitingUntil!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
