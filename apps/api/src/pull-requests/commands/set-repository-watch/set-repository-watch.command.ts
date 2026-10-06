import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class SetRepositoryWatchCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly installationId: string;
  readonly githubRepoId: number;
  readonly watching: boolean;

  constructor(props: CommandProps<SetRepositoryWatchCommand>) {
    super(props);
    this.scope = props.scope;
    this.installationId = props.installationId;
    this.githubRepoId = props.githubRepoId;
    this.watching = props.watching;
  }
}
