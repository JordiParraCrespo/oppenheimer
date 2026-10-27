import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { InboxMark } from '@oppenheimer/shared';

export class PutInboxMarkCommand extends CommandBase {
  /** The request's workspace; null when it acts in none. */
  readonly organizationId: string | null;
  readonly userId: string;
  readonly itemKey: string;
  readonly mark: InboxMark;
  readonly until: Date | null;

  constructor(props: CommandProps<PutInboxMarkCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.itemKey = props.itemKey;
    this.mark = props.mark;
    this.until = props.until;
  }
}
