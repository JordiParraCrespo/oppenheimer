import type { IncomingHttpHeaders } from 'node:http';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class ListMyInvitationsQuery extends QueryBase {
  readonly headers: IncomingHttpHeaders;

  constructor(props: { headers: IncomingHttpHeaders }) {
    super();
    this.headers = props.headers;
  }
}
