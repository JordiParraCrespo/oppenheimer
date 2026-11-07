import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { BOT_DREAM_NOTE_MAX } from '@oppenheimer/shared';
import { Check, Column, Entity, PrimaryColumn, Unique, UpdateDateColumn } from 'typeorm';

/** A bot's latest dream, one per bot (`1794040957267-AddBotMemoryDreams`). */
@Entity('bot_memory_dream')
@Unique('UQ_bot_memory_dream_id', ['id'])
@Check('CHK_bot_memory_dream_counts', `"factsBefore" >= 0 AND "factsAfter" >= 0`)
@Check('CHK_bot_memory_dream_note', `note IS NULL OR char_length(btrim(note)) > 0`)
@Check('CHK_bot_memory_dream_snapshot', `jsonb_typeof(snapshot) = 'array'`)
export class BotMemoryDreamOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_bot_memory_dream' })
  organizationId!: string;

  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_bot_memory_dream' })
  botId!: string;

  @Column({ type: 'uuid' })
  id!: string;

  @Column({ type: 'integer' })
  factsBefore!: number;

  @Column({ type: 'integer' })
  factsAfter!: number;

  @Column({ type: 'varchar', length: BOT_DREAM_NOTE_MAX, nullable: true })
  note!: string | null;

  /** The facts the dream replaced, whole rows, read only by an undo. */
  @Column({ type: 'jsonb' })
  snapshot!: unknown[];

  /** The facts the dream wrote, which an undo deletes. */
  @Column({ type: 'uuid', array: true })
  outputFactIds!: string[];

  /** When the dream ran: written by each dream, not by the undo. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, default: () => 'now()' })
  createdAt!: Date;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  undoneAt!: Date | null;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
