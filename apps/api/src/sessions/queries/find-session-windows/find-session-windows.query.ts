import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/** A session's terminal windows, asked of its runner now. */
export class FindSessionWindowsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly sessionId: string;

  constructor(props: { scope: AccessScope; sessionId: string }) {
    super();
    this.scope = props.scope;
    this.sessionId = props.sessionId;
  }
}
