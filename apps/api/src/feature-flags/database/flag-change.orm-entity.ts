import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * The audit trail: one append-only row per change to a flag or segment.
 *
 * `actorId` has no foreign key on purpose — the history of who pulled a kill
 * switch must outlive that person's account.
 */
@Entity('feature_flag_change')
@Index('IDX_feature_flag_change_subject', ['subjectType', 'subjectKey', 'createdAt'])
@Index('IDX_feature_flag_change_created', ['createdAt'])
export class FlagChangeOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar' })
  subjectType!: 'flag' | 'segment';

  @Column({ type: 'varchar' })
  subjectKey!: string;

  @Column({ type: 'varchar' })
  action!: string;

  @Column({ type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  comment!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  before!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after!: Record<string, unknown> | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
