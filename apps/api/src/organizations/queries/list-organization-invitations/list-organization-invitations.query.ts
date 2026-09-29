import type { IncomingHttpHeaders } from 'node:http';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class ListOrganizationInvitationsQuery extends QueryBase {
  readonly headers: IncomingHttpHeaders;
  readonly organizationId: string;

  constructor(props: { headers: IncomingHttpHeaders; organizationId: string }) {
    super();
    this.headers = props.headers;
    this.organizationId = props.organizationId;
  }
}
