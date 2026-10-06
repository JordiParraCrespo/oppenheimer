import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

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
