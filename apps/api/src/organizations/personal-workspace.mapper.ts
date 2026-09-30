import { ORGANIZATION_ROLES } from '@oppenheimer/shared';
import type { UserRoleOrmEntity } from '../roles/database/user-role.orm-entity';
import type { MemberOrmEntity } from './database/member.orm-entity';
import type { OrganizationOrmEntity } from './database/organization.orm-entity';
import type { PersonalWorkspaceEntity } from './domain/personal-workspace.entity';

/** The three persistence rows one personal workspace is written as. */
export interface PersonalWorkspaceRecords {
  organization: Pick<OrganizationOrmEntity, 'id' | 'name' | 'slug'>;
  member: Pick<MemberOrmEntity, 'id' | 'organizationId' | 'userId' | 'role'>;
  roleGrant: Pick<UserRoleOrmEntity, 'userId' | 'roleId' | 'organizationId'>;
}

/**
 * Translates the personal-workspace aggregate into the rows it is stored as.
 * A pure function, as `AGENTS.md` asks of mappers, and because the seed wires
 * this path by hand. No `toDomain`: nothing loads this aggregate, and a reverse
 * mapping with no reader drifts unnoticed.
 *
 * Only the columns the app owns are written; `logo`, `metadata`, `roleVersion`
 * and `createdAt` keep their database defaults. Better Auth writes these same
 * tables, and a column claimed here is one the two writers could disagree on.
 */
export function toPersonalWorkspaceRecords(
  entity: PersonalWorkspaceEntity,
): PersonalWorkspaceRecords {
  return {
    organization: { id: entity.id, name: entity.name, slug: entity.slug.value },
    member: {
      id: entity.membershipId,
      organizationId: entity.id,
      userId: entity.ownerId,
      // Better Auth's organization role, which is a different vocabulary from
      // the application roles CASL reads — they share the spelling "owner" and
      // nothing else. The grant below is the application one.
      role: ORGANIZATION_ROLES.OWNER,
    },
    roleGrant: {
      userId: entity.ownerId,
      roleId: entity.ownerRoleId,
      organizationId: entity.id,
    },
  };
}
