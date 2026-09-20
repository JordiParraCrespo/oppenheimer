import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/**
 * A page of one session's log, by `seq`.
 *
 * A cursor rather than a page number, because the log only grows: a page number over
 * a growing log re-reads rows it has already shown the moment anything is appended,
 * and `seq` is dense, so `afterSeq` is both stable and cheap.
 */
export class FindSessionEventsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly afterSeq?: number;
  readonly limit: number;

  constructor(props: {
    scope: AccessScope;
    sessionId: string;
    afterSeq?: number;
    limit: number;
  }) {
    super();
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.afterSeq = props.afterSeq;
    this.limit = props.limit;
  }
}
