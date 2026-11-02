import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class StartChatgptLoginCommand extends CommandBase {
  readonly scope: AccessScope;

  constructor(props: CommandProps<StartChatgptLoginCommand>) {
    super(props);
    this.scope = props.scope;
  }
}
