import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class CollectCloudReplyCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Claude Code's cloud session id, as the console names it (`session_…`). */
  readonly cloudSessionId: string;
  /** How long to wait for a reply, in seconds; 0 answers at once. */
  readonly waitSeconds: number;

  constructor(props: CommandProps<CollectCloudReplyCommand>) {
    super(props);
    this.scope = props.scope;
    this.cloudSessionId = props.cloudSessionId;
    this.waitSeconds = props.waitSeconds;
  }
}
