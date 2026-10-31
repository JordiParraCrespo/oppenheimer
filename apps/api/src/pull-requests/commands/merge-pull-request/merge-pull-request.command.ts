import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { MergeMethod } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import type { PullRequestAddress } from '../../../github/application/pull-request-access.port';

export class MergePullRequestCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly address: PullRequestAddress;
  readonly method: MergeMethod;
  /**
   * The head the merge was decided on. When it is given and the pull request
   * has moved on since, nothing is merged (`GITHUB_014`): a push that landed
   * while an approval waited is never merged unseen.
   */
  readonly expectedHeadSha?: string;

  constructor(props: CommandProps<MergePullRequestCommand>) {
    super(props);
    this.scope = props.scope;
    this.address = props.address;
    this.method = props.method;
    this.expectedHeadSha = props.expectedHeadSha;
  }
}
