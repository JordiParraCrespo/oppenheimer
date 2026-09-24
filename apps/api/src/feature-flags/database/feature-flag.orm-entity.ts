import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { FlagRule, FlagServe } from '@oppenheimer/shared/feature-flags';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Persistence model for `feature_flag` — one row per catalog key an operator
 * has configured on this deployment. Rules and the fallthrough are `jsonb`:
 * the aggregate always reads and writes them whole, and the evaluator wants
 * them in exactly this shape.
 */
@Entity('feature_flag')
export class FeatureFlagOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', unique: true })
  key!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  rules!: FlagRule[];

  @Column({ type: 'jsonb' })
  fallthrough!: FlagServe;

  @Column({ type: 'varchar' })
  salt!: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
