import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { UpdateGoalDto } from '@oppenheimer/shared';

export class UpdateGoalCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly goalId: string;
  readonly changes: UpdateGoalDto;

  constructor(props: CommandProps<UpdateGoalCommand>) {
    super(props);
    this.scope = props.scope;
    this.goalId = props.goalId;
    this.changes = props.changes;
  }
}
