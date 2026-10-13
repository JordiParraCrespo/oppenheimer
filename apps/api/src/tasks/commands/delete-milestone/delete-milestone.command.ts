import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteMilestoneCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly milestoneId: string;

  constructor(props: CommandProps<DeleteMilestoneCommand>) {
    super(props);
    this.scope = props.scope;
    this.milestoneId = props.milestoneId;
  }
}
