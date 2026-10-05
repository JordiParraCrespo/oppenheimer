import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** The minute's tick: fire every schedule trigger whose slot has come. */
export class FireDueSchedulesCommand extends CommandBase {
  readonly now: Date;

  constructor(props: CommandProps<FireDueSchedulesCommand>) {
    super(props);
    this.now = props.now;
  }
}
