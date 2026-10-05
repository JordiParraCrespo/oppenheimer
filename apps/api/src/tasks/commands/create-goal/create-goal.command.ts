import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CreateGoalDto } from '@oppenheimer/shared';

export class CreateGoalCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly userId: string;
  readonly input: CreateGoalDto;

  constructor(props: CommandProps<CreateGoalCommand>) {
    super(props);
    this.scope = props.scope;
    this.userId = props.userId;
    this.input = props.input;
  }
}
