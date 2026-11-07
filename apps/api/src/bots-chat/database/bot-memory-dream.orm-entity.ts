import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { BOT_DREAM_NOTE_MAX } from '@oppenheimer/shared';
import { Check, Column, Entity, PrimaryColumn, Unique, UpdateDateColumn } from 'typeorm';

/**
 * A bot's latest dream and its latest try, one row per bot
 * (`1794040957267-AddBotMemoryDreams`). Before the first dream that wrote,
 * the row holds only `triedAt`.
 */
@Entity('bot_memory_dream')
@Unique('UQ_bot_memory_dream_id', ['id'])
@Check(
  'CHK_bot_memory_dream_applied',
  `num_nonnulls(id, "factsBefore", "factsAfter", snapshot, "outputFactIds", "createdAt") IN (0, 6)`,
)
@Check('CHK_bot_memory_dream_counts', `"factsBefore" >= 0 AND "factsAfter" >= 0`)
@Check('CHK_bot_memory_dream_note', `note IS NULL OR char_length(btrim(note)) > 0`)
@Check('CHK_bot_memory_dream_snapshot', `jsonb_typeof(snapshot) = 'array'`)
@Check('CHK_bot_memory_dream_undone', `"undoneAt" IS NULL OR id IS NOT NULL`)
export class BotMemoryDreamOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_bot_memory_dream' })
  organizationId!: string;

  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_bot_memory_dream' })
  botId!: string;

  /** When a dream last started, whether or not it wrote anything. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, default: () => 'now()' })
  triedAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  id!: string | null;

  @Column({ type: 'integer', nullable: true })
  factsBefore!: number | null;

  @Column({ type: 'integer', nullable: true })
  factsAfter!: number | null;

  @Column({ type: 'varchar', length: BOT_DREAM_NOTE_MAX, nullable: true })
  note!: string | null;

  /** The facts the dream replaced, whole rows, read only by an undo. */
  @Column({ type: 'jsonb', nullable: true })
  snapshot!: unknown[] | null;

  /** The facts the dream wrote, which an undo deletes. */
  @Column({ type: 'uuid', array: true, nullable: true })
  outputFactIds!: string[] | null;

  /** When the dream that wrote ran. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  createdAt!: Date | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  undoneAt!: Date | null;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
