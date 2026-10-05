import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class StartInstallationCommand extends CommandBase {
  /** From the resolved access scope, never from the body. */
  readonly organizationId: string;
  /** The person the state is minted for; only they can redeem it. */
  readonly userId: string;

  constructor(props: CommandProps<StartInstallationCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
  }
}
