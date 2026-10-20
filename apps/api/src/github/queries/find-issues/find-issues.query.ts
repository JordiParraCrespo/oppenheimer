import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { RepositoryAddress } from '../../application/pull-request-access.port';
import type { GithubIssueFilter } from '../../infrastructure/github-pulls.port';

/**
 * It has no controller of its own: the console shows no issues yet, and a
 * bot's `list_issues` tool is what dispatches it (`25-bots.md` §4.4).
 */
export class FindIssuesQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly repository: RepositoryAddress;
  readonly filter: GithubIssueFilter;
  readonly limit: number;

  constructor(props: {
    scope: AccessScope;
    repository: RepositoryAddress;
    filter: GithubIssueFilter;
    limit: number;
  }) {
    super();
    this.scope = props.scope;
    this.repository = props.repository;
    this.filter = props.filter;
    this.limit = props.limit;
  }
}
