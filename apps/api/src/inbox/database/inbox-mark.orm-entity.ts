import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { INBOX_ITEM_KEY_MAX } from '@oppenheimer/shared';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** A person's mark on an occurrence of an Inbox item (`1791003500000-AddInboxMarks`). */
@Entity('inbox_mark')
@Index('UQ_inbox_mark_item', ['organizationId', 'userId', 'itemKey'], { unique: true })
@Index('IDX_inbox_mark_user', ['userId'])
@Check('CHK_inbox_mark_mark', `"mark" IN ('done', 'low', 'snoozed', 'deleted')`)
@Check('CHK_inbox_mark_item_key', `char_length("itemKey") > 0`)
@Check(
  'CHK_inbox_mark_until',
  `("mark" = 'snoozed') = ("until" IS NOT NULL) AND ("until" IS NULL OR isfinite("until"))`,
)
export class InboxMarkOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_inbox_mark' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: INBOX_ITEM_KEY_MAX })
  itemKey!: string;

  @Column({ type: 'varchar', length: 16 })
  mark!: string;

  /** When a snooze ends; null for every other mark. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  until!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
