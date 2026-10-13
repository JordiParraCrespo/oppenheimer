import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CreateMilestoneDto } from '@oppenheimer/shared';

export class CreateMilestoneCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly userId: string;
  readonly input: CreateMilestoneDto;

  constructor(props: CommandProps<CreateMilestoneCommand>) {
    super(props);
    this.scope = props.scope;
    this.userId = props.userId;
    this.input = props.input;
  }
}
