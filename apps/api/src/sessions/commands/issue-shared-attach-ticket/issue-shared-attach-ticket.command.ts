import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { SessionShareViewer } from '../../domain/session-share.entity';

export class IssueSharedAttachTicketCommand extends CommandBase {
  readonly slug: string;
  readonly viewer: SessionShareViewer | null;

  constructor(props: CommandProps<IssueSharedAttachTicketCommand>) {
    super(props);
    this.slug = props.slug;
    this.viewer = props.viewer;
  }
}
