import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class OpenSessionWindowCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;

  constructor(props: CommandProps<OpenSessionWindowCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
  }
}
