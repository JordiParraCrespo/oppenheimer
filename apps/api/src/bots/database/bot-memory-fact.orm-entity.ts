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
 * One fact a bot remembers, kept in mind or looked up (`tier`), for itself or
 * for its owner's every bot (`scope`). Capped per bot by the API, counted
 * under a lock on the bot.
 */
@Entity('bot_memory_fact')
@Index('IDX_bot_memory_fact_bot', ['organizationId', 'botId', 'createdAt', 'id'])
@Check('CHK_bot_memory_fact_content', `char_length(btrim("content")) > 0`)
@Check('CHK_bot_memory_fact_source', `"source" IN ('user', 'bot')`)
@Check('CHK_bot_memory_fact_tier', `"tier" IN ('profile', 'log')`)
@Check('CHK_bot_memory_fact_scope', `"scope" IN ('bot', 'person')`)
@Index('IDX_bot_memory_fact_person', ['organizationId', 'botId', 'createdAt', 'id'], {
  where: `"scope" = 'person'`,
})
export class BotMemoryFactOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'varchar', length: 500 })
  content!: string;

  @Column({ type: 'varchar', length: 8, default: 'user' })
  source!: string;

  /** `profile`, in mind every turn; `log`, looked up with `recall`. */
  @Column({ type: 'varchar', length: 8, default: 'profile' })
  tier!: string;

  /** `bot`, this bot's alone; `person`, read by every bot of its owner. */
  @Column({ type: 'varchar', length: 8, default: 'bot' })
  scope!: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
