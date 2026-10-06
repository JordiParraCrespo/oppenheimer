import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { MergeMethod } from '@oppenheimer/shared';
import type { PullRequestAddress } from '../../../github/application/pull-request-access.port';

export class MergePullRequestCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly address: PullRequestAddress;
  readonly method: MergeMethod;

  constructor(props: CommandProps<MergePullRequestCommand>) {
    super(props);
    this.scope = props.scope;
    this.address = props.address;
    this.method = props.method;
  }
}
