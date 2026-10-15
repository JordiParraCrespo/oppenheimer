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

/** One fact a bot remembers. Capped per bot by the API, counted under a lock on the bot. */
@Entity('bot_memory_fact')
@Index('IDX_bot_memory_fact_bot', ['organizationId', 'botId', 'createdAt', 'id'])
@Check('CHK_bot_memory_fact_content', `char_length(btrim("content")) > 0`)
@Check('CHK_bot_memory_fact_source', `"source" IN ('user', 'bot')`)
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

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
