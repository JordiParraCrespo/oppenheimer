import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { BOT_TURN_ERROR_MAX } from '../domain/bot-turn.entity';

/** One message of yours and the bot's answer (`1791001800000-AddBotTurns`). */
@Entity('bot_turn')
@Unique('UQ_bot_turn_organization_id', ['organizationId', 'id'])
@Index('IDX_bot_turn_bot', ['organizationId', 'botId', 'createdAt', 'id'])
@Index('IDX_bot_turn_active', ['organizationId', 'botId', 'createdAt'], {
  where: `"status" IN ('queued', 'running')`,
})
@Index('UQ_bot_turn_running', ['botId'], { unique: true, where: `"status" = 'running'` })
@Index('IDX_bot_turn_requested_by', ['requestedByUserId'], {
  where: '"requestedByUserId" IS NOT NULL',
})
@Check(
  'CHK_bot_turn_status',
  `"status" IN ('queued', 'running', 'completed', 'cancelled', 'failed')`,
)
@Check('CHK_bot_turn_provider', `"provider" IN ('anthropic', 'glm', 'openai')`)
@Check('CHK_bot_turn_tokens', `"inputTokens" >= 0 AND "outputTokens" >= 0`)
export class BotTurnOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'uuid', nullable: true })
  requestedByUserId!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'queued' })
  status!: string;

  @Column({ type: 'varchar', length: 16 })
  provider!: string;

  @Column({ type: 'varchar', length: 128 })
  model!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  effort!: string | null;

  @Column({ type: 'varchar', length: BOT_TURN_ERROR_MAX, nullable: true })
  error!: string | null;

  @Column({ type: 'integer', default: 0 })
  inputTokens!: number;

  @Column({ type: 'integer', default: 0 })
  outputTokens!: number;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  cancelRequestedAt!: Date | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  startedAt!: Date | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  endedAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
