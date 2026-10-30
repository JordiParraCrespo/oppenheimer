import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Reads the new mail of every account a routine watches; the minute job raises it. */
export class PollWatchedMailCommand extends CommandBase {
  readonly now: Date;

  constructor(props: CommandProps<PollWatchedMailCommand>) {
    super(props);
    this.now = props.now;
  }
}
