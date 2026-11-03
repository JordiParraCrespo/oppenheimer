import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RestoreProjectCommand extends CommandBase {
  /** The write loads through the same scoped read the queries use. */
  readonly scope: AccessScope;
  readonly projectId: string;

  constructor(props: CommandProps<RestoreProjectCommand>) {
    super(props);
    this.scope = props.scope;
    this.projectId = props.projectId;
  }
}
