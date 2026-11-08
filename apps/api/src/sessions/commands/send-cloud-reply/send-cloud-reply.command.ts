import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class SendCloudReplyCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly authorId: string;
  readonly text: string;

  constructor(props: CommandProps<SendCloudReplyCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.authorId = props.authorId;
    this.text = props.text;
  }
}
