import { Injectable } from '@nestjs/common';
import type { UserRoleOrmEntity } from '../roles/database/user-role.orm-entity';
import type { MemberOrmEntity } from './database/member.orm-entity';
import type { OrganizationOrmEntity } from './database/organization.orm-entity';
import { PersonalWorkspaceEntity } from './domain/personal-workspace.entity';
import { OrganizationSlug } from './domain/value-objects/organization-slug.value-object';

/** The three persistence rows one personal workspace is written as. */
export interface PersonalWorkspaceRecords {
  organization: Pick<OrganizationOrmEntity, 'id' | 'name' | 'slug'>;
  member: Pick<MemberOrmEntity, 'id' | 'organizationId' | 'userId' | 'role'>;
  roleGrant: Pick<UserRoleOrmEntity, 'userId' | 'roleId' | 'organizationId'>;
}

/**
 * Translates the personal-workspace aggregate to and from the rows it is
 * stored as. The aggregate spans three tables, so `toPersistence` returns the
 * three records rather than one — the shape-to-shape translation the handler
 * and the repository would otherwise each assemble by hand.
 *
 * Only the columns the app owns are written. `logo`, `metadata` and
 * `roleVersion` carry their database defaults, and `createdAt` is the
 * database's: Better Auth writes these same tables, and a column claimed here
 * is one the two writers could disagree about.
 */
@Injectable()
export class PersonalWorkspaceMapper {
  toPersistence(entity: PersonalWorkspaceEntity): PersonalWorkspaceRecords {
    return {
      organization: { id: entity.id, name: entity.name, slug: entity.slug.value },
      member: {
        id: entity.membershipId,
        organizationId: entity.id,
        userId: entity.ownerId,
        role: 'owner',
      },
      roleGrant: {
        userId: entity.ownerId,
        roleId: entity.ownerRoleId,
        organizationId: entity.id,
      },
    };
  }

  toDomain(records: PersonalWorkspaceRecords): PersonalWorkspaceEntity {
    return PersonalWorkspaceEntity.reconstitute({
      id: records.organization.id,
      props: {
        name: records.organization.name,
        slug: new OrganizationSlug({ value: records.organization.slug }),
        ownerId: records.member.userId,
        membershipId: records.member.id,
        ownerRoleId: records.roleGrant.roleId,
      },
    });
  }
}
