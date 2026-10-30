import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Sends every scheduled mail whose time has come; the minute job raises it. */
export class SendDueMailCommand extends CommandBase {
  readonly now: Date;

  constructor(props: CommandProps<SendDueMailCommand>) {
    super(props);
    this.now = props.now;
  }
}
