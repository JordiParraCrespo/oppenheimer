import type { IncomingHttpHeaders } from 'node:http';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class GetInvitationQuery extends QueryBase {
  readonly headers: IncomingHttpHeaders;
  readonly invitationId: string;

  constructor(props: { headers: IncomingHttpHeaders; invitationId: string }) {
    super();
    this.headers = props.headers;
    this.invitationId = props.invitationId;
  }
}
