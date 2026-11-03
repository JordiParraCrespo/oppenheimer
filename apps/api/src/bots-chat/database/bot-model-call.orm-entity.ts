import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A model call a bot made on its owner's key outside its turns
 * (`1793643110340-AddBotUsage`): a goal's review, the conversation's
 * summary, a review of the owner's rules. Append-only.
 */
@Entity('bot_model_call')
@Index('IDX_bot_model_call_bot', ['organizationId', 'botId', 'createdAt'])
@Check('CHK_bot_model_call_purpose', `purpose IN ('goal_review', 'summary', 'rule_review')`)
@Check(
  'CHK_bot_model_call_provider',
  `provider IN ('anthropic', 'glm', 'openai', 'chatgpt', 'xai')`,
)
@Check(
  'CHK_bot_model_call_tokens',
  `"inputTokens" >= 0 AND "outputTokens" >= 0 AND "cacheReadTokens" >= 0 AND "cacheWriteTokens" >= 0`,
)
export class BotModelCallOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_bot_model_call' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'varchar', length: 16 })
  purpose!: string;

  @Column({ type: 'varchar', length: 16 })
  provider!: string;

  @Column({ type: 'varchar', length: 128 })
  model!: string;

  @Column({ type: 'integer', default: 0 })
  inputTokens!: number;

  @Column({ type: 'integer', default: 0 })
  outputTokens!: number;

  @Column({ type: 'integer', default: 0 })
  cacheReadTokens!: number;

  @Column({ type: 'integer', default: 0 })
  cacheWriteTokens!: number;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
