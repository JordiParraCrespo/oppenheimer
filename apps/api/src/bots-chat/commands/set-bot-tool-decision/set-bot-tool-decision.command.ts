import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { BotToolDecision } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

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
