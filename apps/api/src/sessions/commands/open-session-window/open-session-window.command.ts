import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { SessionWindowAgent } from '@oppenheimer/shared';

export class OpenSessionWindowCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  /** The coding agent to start in the new window; absent opens a plain shell. */
  readonly agent?: SessionWindowAgent;

  constructor(props: CommandProps<OpenSessionWindowCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.agent = props.agent;
  }
}
