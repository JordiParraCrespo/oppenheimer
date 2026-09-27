import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { SessionSortDto, SessionState } from '@oppenheimer/shared';

/**
 * Asks for the sessions a caller can reach.
 *
 * `state` is the **stored lifecycle**, not the derived group the sidebar shows: the
 * group is computed on read from things that are not columns, so it cannot be an
 * index and filtering on it would mean reading every row.
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
  }
}
