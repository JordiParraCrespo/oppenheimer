import { CreatedAtColumn, UpdatedAtColumn } from '@oppenheimer/backend-ddd';
import type { PermissionDefinition } from '@oppenheimer/shared';
import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Persistence model for the application-owned `role` table. The domain
 * `RoleEntity` is mapped to/from this record by `RoleMapper`. Permissions are
 * stored inline as a `jsonb` array — the role aggregate owns them, so they are
 * always read and written together.
 */
@Entity('role')
export class RoleOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  /**
   * Owning organization, or `null` for a global/system role template.
   * Uniqueness is per tenant plus a separate uniqueness among globals; both
   * are partial indexes declared in the migration, because Postgres treats
   * NULLs as distinct and a single unique constraint cannot express it.
   */
  @Column({ type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  permissions!: PermissionDefinition[];

  @CreatedAtColumn()
  createdAt!: Date;

  @UpdatedAtColumn()
  updatedAt!: Date;
}
