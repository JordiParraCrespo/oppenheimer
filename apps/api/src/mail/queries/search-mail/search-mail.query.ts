import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { GmailSearchRequest } from '../../infrastructure/gmail-provider.port';

/** One page of a Gmail search in one of the caller's accounts, in Gmail's own query language. */
export class SearchMailQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly connectionId: string;
  readonly request: GmailSearchRequest;

  constructor(props: { scope: AccessScope; connectionId: string; request: GmailSearchRequest }) {
    super();
    this.scope = props.scope;
    this.connectionId = props.connectionId;
    this.request = props.request;
  }
}
