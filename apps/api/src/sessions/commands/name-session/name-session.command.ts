import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Name a session from the first prompt already in its log.
 *
 * No scope and no name on it: the prompt is read from the session's own log, and
 * the caller is the control plane reacting to an event rather than a person asking
 * for something.
 */
export class NameSessionCommand extends CommandBase {
  readonly sessionId: string;

  constructor(props: CommandProps<NameSessionCommand>) {
    super(props);
    this.sessionId = props.sessionId;
  }
}
