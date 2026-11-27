import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class ConfirmCloudReplyCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly userId: string;
  readonly replyId: string;

  constructor(props: CommandProps<ConfirmCloudReplyCommand>) {
    super(props);
    this.scope = props.scope;
    this.userId = props.userId;
    this.replyId = props.replyId;
  }
}
