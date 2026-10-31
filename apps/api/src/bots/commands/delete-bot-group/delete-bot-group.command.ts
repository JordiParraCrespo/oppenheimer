import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class DeleteBotGroupCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly groupId: string;

  constructor(props: CommandProps<DeleteBotGroupCommand>) {
    super(props);
    this.scope = props.scope;
    this.groupId = props.groupId;
  }
}
