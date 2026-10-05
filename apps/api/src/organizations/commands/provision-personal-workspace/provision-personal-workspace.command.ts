import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Dispatched on sign-up by `CompleteSignUpCommandHandler` and by the seed. It
 * carries the account rather than an id alone because the workspace is named
 * after the person, and sign-up already holds the freshly created row.
 */
export class ProvisionPersonalWorkspaceCommand extends CommandBase {
  readonly userId: string;
  readonly email: string;
  readonly name?: string | null;

  constructor(props: CommandProps<ProvisionPersonalWorkspaceCommand>) {
    super(props);
    this.userId = props.userId;
    this.email = props.email;
    this.name = props.name;
  }
}
