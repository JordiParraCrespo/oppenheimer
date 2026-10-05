import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { TaskStatus } from '@oppenheimer/shared';

export class LinkTaskSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly userId: string;
  readonly taskId: string;
  readonly sessionId: string;
  readonly seenStatus: TaskStatus;

  constructor(props: CommandProps<LinkTaskSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.userId = props.userId;
    this.taskId = props.taskId;
    this.sessionId = props.sessionId;
    this.seenStatus = props.seenStatus;
  }
}
