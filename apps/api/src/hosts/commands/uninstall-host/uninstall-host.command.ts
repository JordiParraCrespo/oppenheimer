import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class UninstallHostCommand extends CommandBase {
  readonly hostId: string;

  constructor(props: CommandProps<UninstallHostCommand>) {
    super(props);
    this.hostId = props.hostId;
  }
}
