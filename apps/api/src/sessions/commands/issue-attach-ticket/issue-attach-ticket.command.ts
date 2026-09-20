import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class IssueAttachTicketCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly userId: string;
  /** Tabs are tmux windows, so one ticket authorises one window. */
  readonly window: number;

  constructor(props: CommandProps<IssueAttachTicketCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.userId = props.userId;
    this.window = props.window;
  }
}
