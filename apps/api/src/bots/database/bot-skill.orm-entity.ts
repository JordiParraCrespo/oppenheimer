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
 * One skill of a bot: its name (also its slash command), the description each
 * turn's prompt lists, and the body it reads when it uses it. Capped per bot by
 * the API, counted under a lock on the bot.
 */
@Entity('bot_skill')
@Index('UQ_bot_skill_name', ['organizationId', 'botId', 'name'], { unique: true })
@Check('CHK_bot_skill_name', `"name" ~ '^[a-z0-9][a-z0-9-]{0,31}$'`)
@Check('CHK_bot_skill_description', `char_length(btrim("description")) > 0`)
@Check('CHK_bot_skill_body', `char_length(btrim("body")) > 0 AND char_length("body") <= 16384`)
@Check('CHK_bot_skill_source', `"source" IN ('user', 'bot')`)
export class BotSkillOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'varchar', length: 32 })
  name!: string;

  @Column({ type: 'varchar', length: 280 })
  description!: string;

  @Column({ type: 'text' })
  body!: string;

  /** The person may run it as `/<name>`. */
  @Column({ type: 'boolean', default: true })
  userInvocable!: boolean;

  /** The prompt lists it, so the bot may use it unasked. */
  @Column({ type: 'boolean', default: true })
  modelInvocable!: boolean;

  @Column({ type: 'varchar', length: 8, default: 'user' })
  source!: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
