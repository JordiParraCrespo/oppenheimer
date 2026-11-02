import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** A terminal watch a bot asked for matched (`SessionTerminalMatchedDomainEvent`). */
export class WakeOnTerminalMatchCommand extends CommandBase {
  readonly organizationId: string;
  readonly sessionId: string;
  readonly watchId: string;
  /** New matching lines the runner has counted so far, cumulative. */
  readonly count: number;

  constructor(props: CommandProps<WakeOnTerminalMatchCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.sessionId = props.sessionId;
    this.watchId = props.watchId;
    this.count = props.count;
  }
}
