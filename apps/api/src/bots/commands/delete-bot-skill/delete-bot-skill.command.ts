import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

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
