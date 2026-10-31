import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindCalendarEventQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly eventId: string;

  constructor(props: { scope: AccessScope; eventId: string }) {
    super();
    this.scope = props.scope;
    this.eventId = props.eventId;
  }
}
