import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteGoalCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly goalId: string;

  constructor(props: CommandProps<DeleteGoalCommand>) {
    super(props);
    this.scope = props.scope;
    this.goalId = props.goalId;
  }
}
