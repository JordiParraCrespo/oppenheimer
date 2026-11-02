import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteBotPermissionRuleCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly ruleId: string;

  constructor(props: CommandProps<DeleteBotPermissionRuleCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.ruleId = props.ruleId;
  }
}
