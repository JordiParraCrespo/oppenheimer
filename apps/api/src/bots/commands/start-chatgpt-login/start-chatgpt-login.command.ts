import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class StartChatgptLoginCommand extends CommandBase {
  readonly scope: AccessScope;

  constructor(props: CommandProps<StartChatgptLoginCommand>) {
    super(props);
    this.scope = props.scope;
  }
}
