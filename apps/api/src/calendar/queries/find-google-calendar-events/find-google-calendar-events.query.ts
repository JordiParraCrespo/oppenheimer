import { QueryBase } from '@oppenheimer/backend-ddd';
import type { GoogleCalendarEventsQueryDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindGoogleCalendarEventsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly range: GoogleCalendarEventsQueryDto;

  constructor(props: { scope: AccessScope; range: GoogleCalendarEventsQueryDto }) {
    super();
    this.scope = props.scope;
    this.range = props.range;
  }
}
