import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindRoleByIdQuery extends QueryBase {
  readonly roleId: string;
  readonly activeOrganizationId?: string | null;

  constructor(roleId: string, activeOrganizationId?: string | null) {
    super();
    this.roleId = roleId;
    this.activeOrganizationId = activeOrganizationId;
  }
}
