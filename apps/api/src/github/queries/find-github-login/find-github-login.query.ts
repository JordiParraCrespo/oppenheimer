import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/**
 * No controller: the GitHub login the caller is known by here, which is
 * how an ask on GitHub is told to be theirs (a bot's owner mentioning it).
 */
export class FindGithubLoginQuery extends QueryBase {
  readonly scope: AccessScope;

  constructor(props: { scope: AccessScope }) {
    super();
    this.scope = props.scope;
  }
}
