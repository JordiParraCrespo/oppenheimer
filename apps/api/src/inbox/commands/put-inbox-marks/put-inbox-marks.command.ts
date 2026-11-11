import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { InboxMark } from '@oppenheimer/shared';

export class PutInboxMarksCommand extends CommandBase {
  /** The request's workspace; null when it acts in none. */
  readonly organizationId: string | null;
  readonly userId: string;
  readonly itemKeys: readonly string[];
  /** `null` clears each one's mark. */
  readonly mark: InboxMark | null;
  readonly until: Date | null;

  constructor(props: CommandProps<PutInboxMarksCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.itemKeys = props.itemKeys;
    this.mark = props.mark;
    this.until = props.until;
  }
}
