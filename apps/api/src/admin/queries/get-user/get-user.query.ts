import type { IncomingHttpHeaders } from 'node:http';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class GetUserQuery extends QueryBase {
  readonly headers: IncomingHttpHeaders;
  readonly userId: string;

  constructor(props: { headers: IncomingHttpHeaders; userId: string }) {
    super();
    this.headers = props.headers;
    this.userId = props.userId;
  }
}
