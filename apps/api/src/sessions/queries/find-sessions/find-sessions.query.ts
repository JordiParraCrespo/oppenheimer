import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { SessionSortDto, SessionState } from '@oppenheimer/shared';

/**
 * `state` is the **stored lifecycle**, not the derived group the sidebar shows: the
 * group is computed on read against the clock, so no index holds it and filtering on
 * it would mean reading every row.
 */
export class FindSessionsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly page: number;
  readonly limit: number;
  readonly projectId?: string;
  readonly hostId?: string;
  readonly state?: SessionState;
  readonly githubRepoId?: number;
  readonly agent?: string;
  readonly sort?: SessionSortDto;
  /** Opaque, from the previous page's `meta.nextCursor`. Switches off `page` and the count. */
  readonly cursor?: string;

  constructor(props: {
    scope: AccessScope;
    page: number;
    limit: number;
    projectId?: string;
    hostId?: string;
    state?: SessionState;
    githubRepoId?: number;
    agent?: string;
    sort?: SessionSortDto;
    cursor?: string;
  }) {
    super();
    this.scope = props.scope;
    this.page = props.page;
    this.limit = props.limit;
    this.projectId = props.projectId;
    this.hostId = props.hostId;
    this.state = props.state;
    this.githubRepoId = props.githubRepoId;
    this.agent = props.agent;
    this.sort = props.sort;
    this.cursor = props.cursor;
  }
}
