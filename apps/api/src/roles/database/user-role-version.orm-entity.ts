import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * The version of one user's **global** role assignments (`user_role` rows with
 * `organizationId IS NULL`), which apply in every organization and so cannot
 * ride on an organization's `roleVersion`. Upserted in the same transaction as
 * the assignment write; a user with no row reads as version 0.
 */
@Entity('user_role_version')
export class UserRoleVersionOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_user_role_version' })
  userId!: string;

  @Column({ type: 'bigint', default: 1 })
  version!: string;
}
