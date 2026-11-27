import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class ClaimCloudRepliesCommand extends CommandBase {
  readonly scope: AccessScope;
  /** The person the extension posts as: only their own replies are handed over. */
  readonly userId: string;
  readonly waitSeconds: number;

  constructor(props: CommandProps<ClaimCloudRepliesCommand>) {
    super(props);
    this.scope = props.scope;
    this.userId = props.userId;
    this.waitSeconds = props.waitSeconds;
  }
}
