import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import type { RepositoryAddress } from '../../../github/domain/repository-address.types';

export class SetRepositoryWatchCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly repository: RepositoryAddress;
  readonly watching: boolean;

  constructor(props: CommandProps<SetRepositoryWatchCommand>) {
    super(props);
    this.scope = props.scope;
    this.repository = props.repository;
    this.watching = props.watching;
  }
}
