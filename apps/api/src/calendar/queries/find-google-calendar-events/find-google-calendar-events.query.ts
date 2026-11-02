import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { GoogleCalendarEventsQueryDto } from '@oppenheimer/shared';

export class FindGoogleCalendarEventsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly range: GoogleCalendarEventsQueryDto;

  constructor(props: { scope: AccessScope; range: GoogleCalendarEventsQueryDto }) {
    super();
    this.scope = props.scope;
    this.range = props.range;
  }
}
