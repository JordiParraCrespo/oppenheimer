import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { BOT_APPROVAL_NOTE_MAX, BOT_FORM_TITLE_MAX } from '@oppenheimer/shared';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** A form a bot asked its owner to fill (`1795470000000-AddBotForms`). */
@Entity('bot_form')
@Index('UQ_bot_form_pending', ['botId'], { unique: true, where: `"status" = 'pending'` })
@Index('IDX_bot_form_bot', ['organizationId', 'botId'])
@Index('IDX_bot_form_turn', ['organizationId', 'turnId'])
@Index('IDX_bot_form_decided_by', ['decidedByUserId'], {
  where: '"decidedByUserId" IS NOT NULL',
})
@Check('CHK_bot_form_status', `"status" IN ('pending', 'submitted', 'dismissed', 'expired')`)
@Check('CHK_bot_form_spec', `jsonb_typeof("spec") = 'object'`)
@Check('CHK_bot_form_summary', `char_length("summary") > 0`)
@Check('CHK_bot_form_values', `("status" = 'submitted') = ("values" IS NOT NULL)`)
@Check('CHK_bot_form_decided', `("status" = 'pending') = ("decidedAt" IS NULL)`)
export class BotFormOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'uuid' })
  turnId!: string;

  /** The form as the bot asked it (title, description, fields, button), read whole. */
  @Column({ type: 'jsonb' })
  spec!: object;

  /** The form's title, the line a waiting card is named by. */
  @Column({ type: 'varchar', length: BOT_FORM_TITLE_MAX })
  summary!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: string;

  /** A value per field id, once submitted. */
  @Column({ type: 'jsonb', nullable: true })
  values!: Record<string, string | number | null> | null;

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
