import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { SessionWake } from '../../application/session-wakes.port';

export class DeliverSessionWakeCommand extends CommandBase {
  readonly wake: SessionWake;

  constructor(props: CommandProps<DeliverSessionWakeCommand>) {
    super(props);
    this.wake = props.wake;
  }
}
