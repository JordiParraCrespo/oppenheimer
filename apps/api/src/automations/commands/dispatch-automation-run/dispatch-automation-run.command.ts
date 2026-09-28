import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Look at a pending run and, if the guards allow it, start its session. Run by the runs worker. */
export class DispatchAutomationRunCommand extends CommandBase {
  readonly runId: string;

  constructor(props: CommandProps<DispatchAutomationRunCommand>) {
    super(props);
    this.runId = props.runId;
  }
}
