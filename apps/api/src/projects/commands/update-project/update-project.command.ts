import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { UpdateProjectDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class UpdateProjectCommand extends CommandBase {
  /** The write loads through the same scoped read the queries use. */
  readonly scope: AccessScope;
  readonly projectId: string;
  /** Absent fields are left as they are; `null` clears a default. */
  readonly changes: UpdateProjectDto;

  constructor(props: CommandProps<UpdateProjectCommand>) {
    super(props);
    this.scope = props.scope;
    this.projectId = props.projectId;
    this.changes = props.changes;
  }
}
