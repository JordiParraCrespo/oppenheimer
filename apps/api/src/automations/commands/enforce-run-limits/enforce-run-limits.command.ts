import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** The minute's sweep: stop the sessions of runs live past their workspace's run limit. */
export class EnforceRunLimitsCommand extends CommandBase {
  readonly now: Date;

  constructor(props: CommandProps<EnforceRunLimitsCommand>) {
    super(props);
    this.now = props.now;
  }
}
