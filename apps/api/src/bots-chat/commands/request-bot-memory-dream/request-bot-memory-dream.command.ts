import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Settings → Memory's "Tidy now": the bot dreams its memory, whatever the trigger would say. */
export class RequestBotMemoryDreamCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;

  constructor(props: CommandProps<RequestBotMemoryDreamCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
  }
}
