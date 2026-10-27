import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/** The ports a session's processes listen on, asked of its runner now. */
export class FindSessionPortsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly sessionId: string;

  constructor(props: { scope: AccessScope; sessionId: string }) {
    super();
    this.scope = props.scope;
    this.sessionId = props.sessionId;
  }
}
