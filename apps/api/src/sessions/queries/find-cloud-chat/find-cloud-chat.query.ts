import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/** A Claude Code cloud session's chat: its transcript lines from `from` on, and the replies typed here. */
export class FindCloudChatQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  /** Absent: from the copy's first line. */
  readonly from: number | undefined;
  readonly limit: number;

  constructor(props: {
    scope: AccessScope;
    sessionId: string;
    from: number | undefined;
    limit: number;
  }) {
    super();
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.from = props.from;
    this.limit = props.limit;
  }
}
