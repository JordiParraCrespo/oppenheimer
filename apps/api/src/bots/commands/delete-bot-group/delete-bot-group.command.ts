import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteBotGroupCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly groupId: string;

  constructor(props: CommandProps<DeleteBotGroupCommand>) {
    super(props);
    this.scope = props.scope;
    this.groupId = props.groupId;
  }
}
