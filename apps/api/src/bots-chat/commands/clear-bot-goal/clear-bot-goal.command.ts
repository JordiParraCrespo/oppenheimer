import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** The owner stops a bot's goal (`25-bots.md` §4.1). */
export class ClearBotGoalCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;

  constructor(props: CommandProps<ClearBotGoalCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
  }
}
