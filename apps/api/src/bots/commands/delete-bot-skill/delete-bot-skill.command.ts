import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteBotSkillCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly skillId: string;

  constructor(props: CommandProps<DeleteBotSkillCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.skillId = props.skillId;
  }
}
