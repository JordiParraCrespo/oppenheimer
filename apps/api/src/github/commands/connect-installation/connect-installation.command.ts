import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class ConnectInstallationCommand extends CommandBase {
  /** From the resolved access scope, never from the body. */
  readonly organizationId: string;
  /** The account that completed the installation redirect. */
  readonly userId: string;
  /** GitHub's own installation id, as it arrives on the redirect. */
  readonly githubInstallationId: number;
  /** The OAuth code from the same redirect. Used once and discarded. */
  readonly code: string;

  constructor(props: CommandProps<ConnectInstallationCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.githubInstallationId = props.githubInstallationId;
    this.code = props.code;
  }
}
