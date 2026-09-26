import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class CollectSessionImageCommand extends CommandBase {
  /** The host the assertion named — never a path segment. */
  readonly hostId: string;
  readonly commandId: string;

  constructor(props: CommandProps<CollectSessionImageCommand>) {
    super(props);
    this.hostId = props.hostId;
    this.commandId = props.commandId;
  }
}
