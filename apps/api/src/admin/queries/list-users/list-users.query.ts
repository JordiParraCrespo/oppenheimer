import type { IncomingHttpHeaders } from 'node:http';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { ListUsersQuery as ListUsersFilters } from '@oppenheimer/shared';

export class ListUsersQuery extends QueryBase {
  readonly headers: IncomingHttpHeaders;
  /** The search, page and sort the administrator asked for; each part optional. */
  readonly filters: Partial<ListUsersFilters>;

  constructor(props: { headers: IncomingHttpHeaders; filters: Partial<ListUsersFilters> }) {
    super();
    this.headers = props.headers;
    this.filters = props.filters;
  }
}
