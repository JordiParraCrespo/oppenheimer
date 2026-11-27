import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class ReleaseCloudReplyCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly userId: string;
  readonly replyId: string;
  /** Why claude.ai refused it, for the log. */
  readonly reason: string | undefined;

  constructor(props: CommandProps<ReleaseCloudReplyCommand>) {
    super(props);
    this.scope = props.scope;
    this.userId = props.userId;
    this.replyId = props.replyId;
    this.reason = props.reason;
  }
}
