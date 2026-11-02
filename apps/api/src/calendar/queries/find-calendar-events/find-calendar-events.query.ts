import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindCalendarEventsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly from: string;
  readonly to: string;

  constructor(props: { scope: AccessScope; from: string; to: string }) {
    super();
    this.scope = props.scope;
    this.from = props.from;
    this.to = props.to;
  }
}
