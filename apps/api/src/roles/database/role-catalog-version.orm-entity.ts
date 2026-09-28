import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * The version of the **global** role definitions (`role` rows with
 * `organizationId IS NULL`). A single row, bumped in the same transaction as
 * any create, edit or delete of a global role, and by any migration that edits
 * one. The authorization cache and each replica's snapshot of the global roles
 * are keyed on it (`AddAuthzVersions`).
 *
 * `bigint` comes back from `pg` as a string, which is how the version reader
 * treats every counter: an opaque token compared for equality.
 */
@Entity('role_catalog_version')
@Check('CHK_role_catalog_version_singleton', '"id" = 1')
export class RoleCatalogVersionOrmEntity {
  @PrimaryColumn({
    type: 'smallint',
    default: 1,
    primaryKeyConstraintName: 'PK_role_catalog_version',
  })
  id!: number;

  @Column({ type: 'bigint', default: 1 })
  version!: string;
}
