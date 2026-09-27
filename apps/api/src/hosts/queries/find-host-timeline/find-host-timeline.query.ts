import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { TimelineCursor } from '../../database/host-metadata.repository.port';

/** Asks for a page of one host's timeline, newest first. */
export class FindHostTimelineQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly hostId: string;
  readonly before: TimelineCursor | null;
  readonly limit: number;

  constructor(props: {
    scope: AccessScope;
    hostId: string;
    before: TimelineCursor | null;
    limit: number;
  }) {
    super();
    this.scope = props.scope;
    this.hostId = props.hostId;
    this.before = props.before;
    this.limit = props.limit;
  }
}
