import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { ProjectEntity } from '../../domain/project.entity';

/**
 * The project, and whether this command restored it or found it already
 * active, so a caller can say which without a read of its own.
 */
export interface RestoreProjectResult {
  project: ProjectEntity;
  restored: boolean;
}

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
