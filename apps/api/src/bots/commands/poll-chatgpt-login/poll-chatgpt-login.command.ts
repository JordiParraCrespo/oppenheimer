import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class PollChatgptLoginCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly flowId: string;

  constructor(props: CommandProps<PollChatgptLoginCommand>) {
    super(props);
    this.scope = props.scope;
    this.flowId = props.flowId;
  }
}
