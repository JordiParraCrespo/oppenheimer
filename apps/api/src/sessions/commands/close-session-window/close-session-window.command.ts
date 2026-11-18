import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class CloseSessionWindowCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  /** The tmux window to close; 0, the agent's, is refused. */
  readonly window: number;

  constructor(props: CommandProps<CloseSessionWindowCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.window = props.window;
  }
}
