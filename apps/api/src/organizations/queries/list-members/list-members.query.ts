import { QueryBase } from '@oppenheimer/backend-ddd';

export class ListMembersQuery extends QueryBase {
  readonly organizationId: string;
  readonly search: string | undefined;
  readonly roleIds: string[] | undefined;

  constructor(props: {
    organizationId: string;
    search: string | undefined;
    roleIds: string[] | undefined;
  }) {
    super();
    this.organizationId = props.organizationId;
    this.search = props.search;
    this.roleIds = props.roleIds;
  }
}
