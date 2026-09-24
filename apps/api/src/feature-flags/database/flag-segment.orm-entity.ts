import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { FlagCondition } from '@oppenheimer/shared/feature-flags';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Persistence model for `feature_flag_segment`, the named audiences rules target. */
@Entity('feature_flag_segment')
export class FlagSegmentOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', unique: true })
  key!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  conditions!: FlagCondition[];

  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
