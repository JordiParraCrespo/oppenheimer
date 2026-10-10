import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class SetHostSessionLimitCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly hostId: string;
  /** `null` goes back to the default derived from the machine. */
  readonly maxSessions: number | null;

  constructor(props: CommandProps<SetHostSessionLimitCommand>) {
    super(props);
    this.scope = props.scope;
    this.hostId = props.hostId;
    this.maxSessions = props.maxSessions;
  }
}
