import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class ClearBotMemoryCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;

  constructor(props: CommandProps<ClearBotMemoryCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
  }
}
