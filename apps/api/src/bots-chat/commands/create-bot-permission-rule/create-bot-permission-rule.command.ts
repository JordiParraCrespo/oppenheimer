import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { BotPermissionRuleEffect } from '@oppenheimer/shared';

export class CreateBotPermissionRuleCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly effect: BotPermissionRuleEffect;
  readonly text: string;

  constructor(props: CommandProps<CreateBotPermissionRuleCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.effect = props.effect;
    this.text = props.text;
  }
}
