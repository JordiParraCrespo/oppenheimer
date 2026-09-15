import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Join table linking Better Auth users to application roles.
 *
 * An assignment is scoped to an organization; `organizationId` is `null` for a
 * global assignment (system roles, platform admins). A user's effective
 * permissions are the union of their global roles and the roles assigned to
 * them in the active organization.
 *
 * The primary key is a surrogate rather than the natural triple because the
 * organization is nullable and Postgres does not allow NULLs in a primary key.
 * Uniqueness is enforced by the two partial indexes in the migration.
 */
@Entity('user_role')
@Index(['userId'])
@Index(['userId', 'organizationId'])
export class UserRoleOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  roleId!: string;

  @Column({ type: 'uuid', nullable: true })
  organizationId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
