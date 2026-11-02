import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AddPullRequestCommentDto } from '@oppenheimer/shared';
import type { PullRequestAddress } from '../../../github/application/pull-request-access.port';

export class AddPullRequestCommentCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly address: PullRequestAddress;
  readonly comment: AddPullRequestCommentDto;

  constructor(props: CommandProps<AddPullRequestCommentCommand>) {
    super(props);
    this.scope = props.scope;
    this.address = props.address;
    this.comment = props.comment;
  }
}
