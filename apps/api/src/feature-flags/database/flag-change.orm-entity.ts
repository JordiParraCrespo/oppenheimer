import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * The audit trail: one append-only row per change to a flag or segment.
 *
 * `actorId` has no foreign key on purpose — the history of who pulled a kill
 * switch must outlive that person's account. The id is the id of the domain
 * event that produced the row, so a redelivery lands on the same key.
 */
@Entity('feature_flag_change')
@Index('IDX_feature_flag_change_subject', ['subjectType', 'subjectKey', 'createdAt'])
@Index('IDX_feature_flag_change_created', ['createdAt'])
@Check('CHK_feature_flag_change_subject_type', `"subjectType" IN ('flag', 'segment')`)
@Check(
  'CHK_feature_flag_change_action',
  `"action" IN ('targeting_updated', 'toggled', 'segment_created', 'segment_updated', 'segment_deleted')`,
)
export class FlagChangeOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  subjectType!: 'flag' | 'segment';

  @Column({ type: 'varchar', length: 64 })
  subjectKey!: string;

  @Column({ type: 'varchar', length: 32 })
  action!: string;

  @Column({ type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comment!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  before!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after!: Record<string, unknown> | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
