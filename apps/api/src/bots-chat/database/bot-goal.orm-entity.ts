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

/** A bot's goal (`1791004900000-AddBotGoals`, widened by `1793609253967-WidenBotGoals`). */
@Entity('bot_goal')
@Index('UQ_bot_goal_bot', ['organizationId', 'botId'], { unique: true })
@Index('IDX_bot_goal_origin_turn', ['organizationId', 'originTurnId'])
@Check('CHK_bot_goal_objective', `char_length(objective) > 0`)
@Check('CHK_bot_goal_limit', `"limit" BETWEEN 1 AND 20`)
@Check('CHK_bot_goal_continuations', `continuations BETWEEN 0 AND "limit"`)
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

  @Column({ type: 'integer' })
  limit!: number;

  @Column({ type: 'integer', default: 0 })
  continuations!: number;

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
