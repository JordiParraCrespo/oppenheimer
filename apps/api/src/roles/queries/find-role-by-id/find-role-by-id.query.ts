import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindRoleByIdQuery extends QueryBase {
  readonly roleId: string;
  readonly organizationId?: string | null;

  constructor(roleId: string, organizationId?: string | null) {
    super();
    this.roleId = roleId;
    this.organizationId = organizationId;
  }
}
