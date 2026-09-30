import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Join table linking Better Auth users to application roles. An assignment is scoped
 * to an organization, or `null` for a global one (system roles, platform admins).
 *
 * The primary key is a surrogate because the organization is nullable and Postgres
 * allows no NULLs in a primary key; uniqueness is the two partial indexes in the
 * migration.
 */
@Entity('user_role')
@Index(['userId'])
@Index(['userId', 'organizationId'])
// Back FK_user_role_role and FK_user_role_organization.
@Index('IDX_user_role_role', ['roleId'])
@Index('IDX_user_role_organization', ['organizationId'], {
  where: '"organizationId" IS NOT NULL',
})
export class UserRoleOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  roleId!: string;

  @Column({ type: 'uuid', nullable: true })
  organizationId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
