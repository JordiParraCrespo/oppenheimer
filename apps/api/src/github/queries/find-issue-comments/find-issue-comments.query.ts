import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { IssueAddress } from '../../application/issue-access.port';

/** No controller: a bot's `get_issue` tool dispatches it (`25-bots.md` §4.4). */
export class FindIssueCommentsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly address: IssueAddress;

  constructor(props: { scope: AccessScope; address: IssueAddress }) {
    super();
    this.scope = props.scope;
    this.address = props.address;
  }
}
