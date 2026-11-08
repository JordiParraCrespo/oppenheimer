import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { TerminalDriveRequest } from '../../application/session-terminal.port';

/** Type into a blank-terminal session and read its screen back, for a bot. */
export class DriveSessionTerminalCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly request: TerminalDriveRequest;

  constructor(props: CommandProps<DriveSessionTerminalCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.request = props.request;
  }
}
