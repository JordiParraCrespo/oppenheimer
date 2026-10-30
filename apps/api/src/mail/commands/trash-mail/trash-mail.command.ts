import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Moves threads of the caller's Gmail to Trash, or brings them back. Nothing is deleted for good. */
export class TrashMailCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly connectionId: string;
  readonly threadIds: readonly string[];
  /** True to move to Trash, false to bring back out of it. */
  readonly trash: boolean;

  constructor(props: CommandProps<TrashMailCommand>) {
    super(props);
    this.scope = props.scope;
    this.connectionId = props.connectionId;
    this.threadIds = props.threadIds;
    this.trash = props.trash;
  }
}
