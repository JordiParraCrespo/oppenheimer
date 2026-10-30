import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { BOT_APPROVAL_NOTE_MAX } from '@oppenheimer/shared';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** A card of questions a bot put to its owner (`1791005100000-AddBotQuestions`). */
@Entity('bot_question')
@Index('UQ_bot_question_pending', ['botId'], { unique: true, where: `"status" = 'pending'` })
@Index('IDX_bot_question_bot', ['organizationId', 'botId'])
@Index('IDX_bot_question_turn', ['organizationId', 'turnId'])
@Index('IDX_bot_question_decided_by', ['decidedByUserId'], {
  where: '"decidedByUserId" IS NOT NULL',
})
@Check('CHK_bot_question_status', `"status" IN ('pending', 'answered', 'dismissed', 'expired')`)
@Check(
  'CHK_bot_question_questions',
  `jsonb_typeof("questions") = 'array' AND jsonb_array_length("questions") BETWEEN 1 AND 4`,
)
@Check('CHK_bot_question_summary', `char_length("summary") > 0`)
@Check('CHK_bot_question_answers', `("status" = 'answered') = ("answers" IS NOT NULL)`)
@Check('CHK_bot_question_decided', `("status" = 'pending') = ("decidedAt" IS NULL)`)
export class BotQuestionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'uuid' })
  turnId!: string;

  /** The questions as the bot asked them, read whole. */
  @Column({ type: 'jsonb' })
  questions!: unknown[];

  @Column({ type: 'varchar', length: 500 })
  summary!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: string;

  /** One per question, once answered. */
  @Column({ type: 'jsonb', nullable: true })
  answers!: { picks: number[]; other: string | null }[] | null;

  @Column({ type: 'varchar', length: BOT_APPROVAL_NOTE_MAX, nullable: true })
  note!: string | null;

  @Column({ type: 'uuid', nullable: true })
  decidedByUserId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  decidedWithScopes!: string[] | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  decidedAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
