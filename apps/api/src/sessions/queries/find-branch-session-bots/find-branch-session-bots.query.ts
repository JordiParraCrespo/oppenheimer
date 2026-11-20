import { QueryBase } from '@oppenheimer/backend-ddd';

/**
 * The bots that started a session on this repository's branch, a host
 * session's checkout or a cloud session's run alike: what a routine woken by
 * a GitHub event on it asks, to skip its own bot's work (`ownSessionGuard`).
 * Workspace-scoped by argument, as the event is.
 */
export class FindBranchSessionBotsQuery extends QueryBase {
  readonly organizationId: string;
  /** GitHub's repository id, as the event's subject names it. */
  readonly githubRepoId: string;
  /** Its `owner/name`: a cloud session's run names its repository by URL, not by id. */
  readonly repositoryFullName: string;
  readonly branch: string;

  constructor(props: {
    organizationId: string;
    githubRepoId: string;
    repositoryFullName: string;
    branch: string;
  }) {
    super();
    this.organizationId = props.organizationId;
    this.githubRepoId = props.githubRepoId;
    this.repositoryFullName = props.repositoryFullName;
    this.branch = props.branch;
  }
}
