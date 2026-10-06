import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { UpdateTaskDto } from '@oppenheimer/shared';

export class UpdateTaskCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly taskId: string;
  readonly changes: UpdateTaskDto;

  constructor(props: CommandProps<UpdateTaskCommand>) {
    super(props);
    this.scope = props.scope;
    this.taskId = props.taskId;
    this.changes = props.changes;
  }
}
