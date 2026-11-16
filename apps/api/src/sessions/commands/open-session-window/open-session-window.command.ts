import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { OpenSessionWindowBody } from '@oppenheimer/shared';

export class OpenSessionWindowCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  /**
   * What to open: no `agent` for a plain shell, or the coding agent to start
   * and its `model`, `effort` and `permission` (each absent the session's own).
   */
  readonly window: OpenSessionWindowBody;

  constructor(props: CommandProps<OpenSessionWindowCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.window = props.window;
  }
}
