import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { FlagRule, FlagServe } from '@oppenheimer/shared/feature-flags';
import { Column, CreateDateColumn, Entity, PrimaryColumn, Unique, UpdateDateColumn } from 'typeorm';

/**
 * Persistence model for `feature_flag` — one row per catalog key an operator
 * has configured on this deployment. Rules and the fallthrough are `jsonb`:
 * the aggregate always reads and writes them whole, and the evaluator wants
 * them in exactly this shape.
 */
@Entity('feature_flag')
@Unique('UQ_feature_flag_key', ['key'])
export class FeatureFlagOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  key!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  rules!: FlagRule[];

  @Column({ type: 'jsonb' })
  fallthrough!: FlagServe;

  @Column({ type: 'varchar', length: 32 })
  salt!: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
