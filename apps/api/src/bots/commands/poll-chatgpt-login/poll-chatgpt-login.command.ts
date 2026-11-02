import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class PollChatgptLoginCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly flowId: string;

  constructor(props: CommandProps<PollChatgptLoginCommand>) {
    super(props);
    this.scope = props.scope;
    this.flowId = props.flowId;
  }
}
