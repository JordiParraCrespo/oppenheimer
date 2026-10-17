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

/** One thing a bot's chat draws (`1791001800000-AddBotTurns`). */
@Entity('bot_message')
@Index('IDX_bot_message_bot', ['organizationId', 'botId', 'createdAt', 'id'])
@Index('IDX_bot_message_turn', ['organizationId', 'turnId', 'position'])
@Check('CHK_bot_message_role', `"role" IN ('user', 'assistant', 'activity', 'event')`)
@Check('CHK_bot_message_event', `("role" = 'event') = ("event" IS NOT NULL)`)
@Check('CHK_bot_message_position', `"position" >= 0`)
export class BotMessageOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'uuid' })
  turnId!: string;

  @Column({ type: 'varchar', length: 16 })
  role!: string;

  @Column({ type: 'text', default: '' })
  content!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  /** An activity line's calls (`BotToolStep`), read whole. */
  steps!: Record<string, unknown>[];

  @Column({ type: 'integer', default: 0 })
  position!: number;

  /** What an event says happened (`BotMessageEvent`), read whole; null on anything else. */
  @Column({ type: 'jsonb', nullable: true })
  event!: Record<string, unknown> | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
