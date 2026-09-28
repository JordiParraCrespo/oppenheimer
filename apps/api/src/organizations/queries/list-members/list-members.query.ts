import type { IncomingHttpHeaders } from 'node:http';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class ListMembersQuery extends QueryBase {
  readonly headers: IncomingHttpHeaders;
  readonly organizationId: string;
  readonly search: string | undefined;
  readonly roleIds: string[] | undefined;

  constructor(props: {
    headers: IncomingHttpHeaders;
    organizationId: string;
    search: string | undefined;
    roleIds: string[] | undefined;
  }) {
    super();
    this.headers = props.headers;
    this.organizationId = props.organizationId;
    this.search = props.search;
    this.roleIds = props.roleIds;
  }
}
