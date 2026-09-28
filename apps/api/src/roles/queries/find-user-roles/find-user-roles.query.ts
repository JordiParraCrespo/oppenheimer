import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindUserRolesQuery extends QueryBase {
  readonly userId: string;
  readonly organizationId?: string | null;

  constructor(userId: string, organizationId?: string | null) {
    super();
    this.userId = userId;
    this.organizationId = organizationId;
  }
}
