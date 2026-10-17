import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class UpdateBotMemoryFactCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly factId: string;
  readonly content: string;

  constructor(props: CommandProps<UpdateBotMemoryFactCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.factId = props.factId;
    this.content = props.content;
  }
}
