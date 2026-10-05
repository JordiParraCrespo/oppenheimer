import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CreateTaskDto } from '@oppenheimer/shared';

export class CreateTaskCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly userId: string;
  readonly input: CreateTaskDto;

  constructor(props: CommandProps<CreateTaskCommand>) {
    super(props);
    this.scope = props.scope;
    this.userId = props.userId;
    this.input = props.input;
  }
}
