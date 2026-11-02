import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { BotToolDecision } from '@oppenheimer/shared';

export class SetBotToolDecisionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly tool: string;
  readonly decision: BotToolDecision | 'default';

  constructor(props: CommandProps<SetBotToolDecisionCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.tool = props.tool;
    this.decision = props.decision;
  }
}
