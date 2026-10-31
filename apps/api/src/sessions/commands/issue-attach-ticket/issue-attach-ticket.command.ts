import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class IssueAttachTicketCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly userId: string;
  /** Tabs are tmux windows, so one ticket authorises one window. */
  readonly window: number;
  /** The session's device rather than a window's terminal. */
  readonly device: boolean;

  constructor(props: CommandProps<IssueAttachTicketCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.userId = props.userId;
    this.window = props.window;
    this.device = props.device;
  }
}
