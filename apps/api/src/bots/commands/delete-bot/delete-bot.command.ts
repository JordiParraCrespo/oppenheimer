import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class DeleteBotCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;

  constructor(props: CommandProps<DeleteBotCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
  }
}
