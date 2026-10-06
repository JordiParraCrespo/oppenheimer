import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class UnlinkTaskSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly taskId: string;
  readonly sessionId: string;

  constructor(props: CommandProps<UnlinkTaskSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.taskId = props.taskId;
    this.sessionId = props.sessionId;
  }
}
