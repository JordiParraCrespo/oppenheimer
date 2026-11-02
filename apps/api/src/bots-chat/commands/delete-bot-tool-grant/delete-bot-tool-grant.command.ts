import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteBotToolGrantCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly grantId: string;

  constructor(props: CommandProps<DeleteBotToolGrantCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.grantId = props.grantId;
  }
}
