import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/** Asks GitHub for one repository's branches, to offer as a checkout's base. */
export class ListRepositoryBranchesQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly installationId: string;
  /** GitHub's own repository id — what the picker has and a checkout records. */
  readonly githubRepoId: number;

  constructor(props: { scope: AccessScope; installationId: string; githubRepoId: number }) {
    super();
    this.scope = props.scope;
    this.installationId = props.installationId;
    this.githubRepoId = props.githubRepoId;
  }
}
