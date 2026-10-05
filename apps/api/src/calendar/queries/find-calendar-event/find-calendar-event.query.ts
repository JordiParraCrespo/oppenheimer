import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindCalendarEventQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly eventId: string;

  constructor(props: { scope: AccessScope; eventId: string }) {
    super();
    this.scope = props.scope;
    this.eventId = props.eventId;
  }
}
