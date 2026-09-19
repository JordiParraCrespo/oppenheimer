import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class ArchiveProjectCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly projectId: string;

  constructor(props: CommandProps<ArchiveProjectCommand>) {
    super(props);
    this.scope = props.scope;
    this.projectId = props.projectId;
  }
}
