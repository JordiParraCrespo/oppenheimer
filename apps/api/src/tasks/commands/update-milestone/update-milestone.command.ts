import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { UpdateMilestoneDto } from '@oppenheimer/shared';

export class UpdateMilestoneCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly milestoneId: string;
  readonly changes: UpdateMilestoneDto;

  constructor(props: CommandProps<UpdateMilestoneCommand>) {
    super(props);
    this.scope = props.scope;
    this.milestoneId = props.milestoneId;
    this.changes = props.changes;
  }
}
