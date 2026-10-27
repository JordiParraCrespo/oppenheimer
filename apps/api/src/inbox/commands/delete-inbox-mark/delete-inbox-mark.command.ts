import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteInboxMarkCommand extends CommandBase {
  /** The request's workspace; null when it acts in none. */
  readonly organizationId: string | null;
  readonly userId: string;
  readonly itemKey: string;

  constructor(props: CommandProps<DeleteInboxMarkCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.itemKey = props.itemKey;
  }
}
