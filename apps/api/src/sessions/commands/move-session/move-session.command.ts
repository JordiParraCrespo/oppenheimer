import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class MoveSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  /** The project to list the session under. */
  readonly projectId: string;

  constructor(props: CommandProps<MoveSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.projectId = props.projectId;
  }
}
