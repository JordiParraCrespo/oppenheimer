import type { Locale, TableDensity, Theme } from '@oppenheimer/shared';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Persistence model for a user's workspace preferences. Infrastructure — the
 * domain `UserSettingsEntity` is mapped to/from this record by `ProfileMapper`.
 *
 * The primary key is the user's id: one settings row per user, no surrogate.
 * The union-typed columns carry an explicit `type` because
 * `emitDecoratorMetadata` reflects a union as `Object`, which Postgres rejects
 * (see `.agents/rules/typeorm.md`).
 */
@Entity('user_settings')
export class UserSettingsOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', default: 'system' })
  theme!: Theme;

  @Column({ type: 'varchar', default: 'en' })
  locale!: Locale;

  @Column({ type: 'varchar', default: 'comfortable' })
  density!: TableDensity;

  @Column({ type: 'boolean', default: true })
  weeklyDigest!: boolean;

  @Column({ type: 'boolean', default: false })
  productUpdates!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
