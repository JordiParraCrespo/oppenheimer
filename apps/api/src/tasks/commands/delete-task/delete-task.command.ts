import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteTaskCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly taskId: string;

  constructor(props: CommandProps<DeleteTaskCommand>) {
    super(props);
    this.scope = props.scope;
    this.taskId = props.taskId;
  }
}
