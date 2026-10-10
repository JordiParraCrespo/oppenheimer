import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { ShareLinkViewer } from '../../domain/session-share-link.entity';

export class IssueSharedAttachTicketCommand extends CommandBase {
  readonly token: string;
  readonly viewer: ShareLinkViewer | null;

  constructor(props: CommandProps<IssueSharedAttachTicketCommand>) {
    super(props);
    this.token = props.token;
    this.viewer = props.viewer;
  }
}
