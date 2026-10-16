import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/** One directory on a host, listed by its runner, with the caller's recent folders there. */
export class FindHostFoldersQuery extends QueryBase {
  readonly scope: AccessScope;
  /** Whose recent folders: a host is a person's, and so are the folders picked on it. */
  readonly userId: string;
  readonly hostId: string;
  /** Absent lists the home directory of the user the runner runs as. */
  readonly path?: string;

  constructor(props: { scope: AccessScope; userId: string; hostId: string; path?: string }) {
    super();
    this.scope = props.scope;
    this.userId = props.userId;
    this.hostId = props.hostId;
    this.path = props.path;
  }
}
