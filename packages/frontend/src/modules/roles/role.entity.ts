import type { AuthzResourceGroupDto, AuthzRuleDto } from '@oppenheimer/api-client';
import type { PermissionDefinition } from '@oppenheimer/shared';

export class RoleEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly isSystem: boolean,
    public readonly organizationId: string | null,
    public readonly permissions: PermissionDefinition[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}

export interface RolePage {
  data: RoleEntity[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/**
 * What the roles list is narrowed to. The endpoint has always been paginated
 * (`GET /roles` returns `{ data, meta }`); this carries the page the table
 * asks for rather than the data-access layer hardcoding the first hundred.
 */
export interface FindRolesParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface AuthorizationCatalog {
  groups: AuthzResourceGroupDto[];
  grantable: AuthzRuleDto[];
}
