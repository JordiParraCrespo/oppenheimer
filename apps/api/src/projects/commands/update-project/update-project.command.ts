import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class UpdateProjectCommand extends CommandBase {
  /** The write loads through the same scoped read the queries use. */
  readonly scope: AccessScope;
  readonly projectId: string;
  readonly name: string;

  constructor(props: CommandProps<UpdateProjectCommand>) {
    super(props);
    this.scope = props.scope;
    this.projectId = props.projectId;
    this.name = props.name;
  }
}
