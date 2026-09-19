import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * A host saying it is gone. The id comes from the assertion it signed, never
 * from the request path — there is nothing for a caller to name here.
 */
export class UninstallHostCommand extends CommandBase {
  readonly hostId: string;

  constructor(props: CommandProps<UninstallHostCommand>) {
    super(props);
    this.hostId = props.hostId;
  }
}
