import type { IncomingHttpHeaders } from 'node:http';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class ListWorkspacesQuery extends QueryBase {
  readonly headers: IncomingHttpHeaders;
  readonly organizationId: string | undefined;

  constructor(props: { headers: IncomingHttpHeaders; organizationId: string | undefined }) {
    super();
    this.headers = props.headers;
    this.organizationId = props.organizationId;
  }
}
