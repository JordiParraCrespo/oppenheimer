import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Stop a terminal watch. By the workspace rather than a caller's scope: the
 * module that asked for the watch ends it when its own reason ends, which
 * may be after its owner lost the session (`27-bot-subscriptions.md` §4).
 */
export class UnwatchSessionTerminalCommand extends CommandBase {
  readonly organizationId: string;
  readonly sessionId: string;
  readonly watchId: string;

  constructor(props: CommandProps<UnwatchSessionTerminalCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.sessionId = props.sessionId;
    this.watchId = props.watchId;
  }
}
