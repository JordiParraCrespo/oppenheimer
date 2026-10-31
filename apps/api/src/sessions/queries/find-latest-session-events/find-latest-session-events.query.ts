import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import type { WorkSessionEventEntity } from '../../domain/work-session-event.entity';

/** What a session did lately, with the session it belongs to. */
export interface LatestSessionEvents {
  session: WorkSessionEntity;
  events: WorkSessionEventEntity[];
}

/** The last entries of one session's log, oldest first: what it did lately. */
export class FindLatestSessionEventsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly limit: number;

  constructor(props: { scope: AccessScope; sessionId: string; limit: number }) {
    super();
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.limit = props.limit;
  }
}
