import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { MoveTaskDto } from '@oppenheimer/shared';

export class MoveTaskCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly taskId: string;
  readonly move: MoveTaskDto;

  constructor(props: CommandProps<MoveTaskCommand>) {
    super(props);
    this.scope = props.scope;
    this.taskId = props.taskId;
    this.move = props.move;
  }
}
