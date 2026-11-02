import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteBotMemoryFactCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly factId: string;

  constructor(props: CommandProps<DeleteBotMemoryFactCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.factId = props.factId;
  }
}
