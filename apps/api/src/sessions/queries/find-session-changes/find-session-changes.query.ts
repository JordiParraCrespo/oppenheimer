import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { SessionChangesScopeValue } from '@oppenheimer/shared';

/** What a session's checkouts changed, asked of its runner now. */
export class FindSessionChangesQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly compare: SessionChangesScopeValue;

  constructor(props: { scope: AccessScope; sessionId: string; compare: SessionChangesScopeValue }) {
    super();
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.compare = props.compare;
  }
}
