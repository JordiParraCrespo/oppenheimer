import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import type { TimelineCursor } from '../../database/host-metadata.repository.port';

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
