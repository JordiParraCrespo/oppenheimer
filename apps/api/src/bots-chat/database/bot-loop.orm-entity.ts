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

/** A bot's loop (`1793709569630-AddBotLoops`). */
@Entity('bot_loop')
@Index('UQ_bot_loop_bot', ['organizationId', 'botId'], { unique: true })
@Index('IDX_bot_loop_origin_turn', ['organizationId', 'originTurnId'])
@Check('CHK_bot_loop_prompt', `char_length(prompt) > 0`)
@Check('CHK_bot_loop_interval', `"intervalMinutes" IS NULL OR "intervalMinutes" BETWEEN 1 AND 1440`)
@Check('CHK_bot_loop_runs', `runs >= 0`)
@Check(
  'CHK_bot_loop_expires',
  `isfinite("expiresAt") AND "expiresAt" - "createdAt" <= interval '3 days 1 minute'`,
)
@Check(
  'CHK_bot_loop_credential_scopes',
  `"credentialScopes" IS NULL OR jsonb_typeof("credentialScopes") = 'array'`,
)
export class BotLoopOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_bot_loop' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  /** The bot's turn that set it: its first run. */
  @Column({ type: 'uuid' })
  originTurnId!: string;

  @Column({ type: 'varchar', length: 2000 })
  prompt!: string;

  /** Null when self-paced. */
  @Column({ type: 'integer', nullable: true })
  intervalMinutes!: number | null;

  /** The runs queued after the first. */
  @Column({ type: 'integer', default: 0 })
  runs!: number;

  /** When the next run is due; null while a self-paced loop waits for its run to say. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  nextRunAt!: Date | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  expiresAt!: Date;

  /** The setting turn's credential scopes; null for a browser session. */
  @Column({ type: 'jsonb', nullable: true })
  credentialScopes!: string[] | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  timeZone!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
