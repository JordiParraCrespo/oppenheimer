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

/**
 * One message of yours and the bot's answer (`1791001800000-AddBotTurns`), or
 * one another bot sent it (`1791002600000-AddBotPeerMessages`).
 */
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
@Check('CHK_bot_turn_provider', `"provider" IN ('anthropic', 'glm', 'openai', 'chatgpt')`)
@Check('CHK_bot_turn_tokens', `"inputTokens" >= 0 AND "outputTokens" >= 0`)
@Check('CHK_bot_turn_lane', `"lane" IN ('owner', 'bots', 'background')`)
@Check('CHK_bot_turn_chain_depth', `"chainDepth" >= 0`)
@Index('IDX_bot_turn_chain', ['organizationId', 'chainId'], { where: '"chainId" IS NOT NULL' })
@Index('UQ_bot_turn_answers', ['organizationId', 'answersTurnId'], {
  unique: true,
  where: '"answersTurnId" IS NOT NULL',
})
@Index('IDX_bot_turn_asked_by_bot', ['organizationId', 'askedByBotId'], {
  where: '"askedByBotId" IS NOT NULL',
})
@Index('IDX_bot_turn_asked_by_turn', ['organizationId', 'askedByTurnId'], {
  where: '"askedByTurnId" IS NOT NULL',
})
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

  /** The sender's IANA time zone; null means UTC. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  timeZone!: string | null;

  /** The sending credential's scopes; null for a browser session. Read whole, never filtered. */
  @Column({ type: 'jsonb', nullable: true })
  credentialScopes!: string[] | null;

  @Column({ type: 'varchar', length: BOT_TURN_ERROR_MAX, nullable: true })
  error!: string | null;

  @Column({ type: 'integer', default: 0 })
  inputTokens!: number;

  @Column({ type: 'integer', default: 0 })
  outputTokens!: number;

  /** Which of the bot's waiting turns runs first (`BotTurnLane`). */
  @Column({ type: 'varchar', length: 16, default: 'owner' })
  lane!: string;

  /** The first turn of the chain this one belongs to; null on an owner turn. No FK: a correlation id. */
  @Column({ type: 'uuid', nullable: true })
  chainId!: string | null;

  @Column({ type: 'smallint', default: 0 })
  chainDepth!: number;

  /** The bot whose call queued this turn; null on yours, or once that bot is deleted. */
  @Column({ type: 'uuid', nullable: true })
  askedByBotId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  askedByTurnId!: string | null;

  /** Sent with `ask_bot`: the answer goes back to the asker when this turn ends. */
  @Column({ type: 'boolean', default: false })
  replyRequested!: boolean;

  /** On an answer's turn: the turn it answers. */
  @Column({ type: 'uuid', nullable: true })
  answersTurnId!: string | null;

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
