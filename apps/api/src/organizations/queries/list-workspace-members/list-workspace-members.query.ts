import type { IncomingHttpHeaders } from 'node:http';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class ListWorkspaceMembersQuery extends QueryBase {
  readonly headers: IncomingHttpHeaders;
  readonly workspaceId: string;

  constructor(props: { headers: IncomingHttpHeaders; workspaceId: string }) {
    super();
    this.headers = props.headers;
    this.workspaceId = props.workspaceId;
  }
}
