import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { UpdateBotGroupDto } from '@oppenheimer/shared';

export class UpdateBotGroupCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly groupId: string;
  readonly input: UpdateBotGroupDto;

  constructor(props: CommandProps<UpdateBotGroupCommand>) {
    super(props);
    this.scope = props.scope;
    this.groupId = props.groupId;
    this.input = props.input;
  }
}
